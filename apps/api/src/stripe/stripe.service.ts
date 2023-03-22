import { InjectStripeClient } from '@golevelup/nestjs-stripe'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import Stripe from 'stripe'
import { FinalizeSetupIntentDto } from './dto/finalize-setup-intent.dto'
import { UpdateSetupIntentDto } from './dto/update-setup-intent.dto'

@Injectable()
export class StripeService {
  constructor(@InjectStripeClient() private stripeClient: Stripe) {}

  /**
   * Update a setup intent for a donation
   * @param inputDto Payment intent update params
   * @returns {Promise<Stripe.Response<Stripe.SetupIntent>>}
   */
  async updateSetupIntent(
    id: string,
    inputDto: UpdateSetupIntentDto,
  ): Promise<Stripe.Response<Stripe.SetupIntent>> {
    return await this.stripeClient.setupIntents.update(id, inputDto)
  }
  /**
   * Create a payment intent for a donation
   * https://stripe.com/docs/api/payment_intents/create
   * @param inputDto Payment intent create params
   * @returns {Promise<Stripe.Response<Stripe.PaymentIntent>>}
   */
  async finalizeSetupIntent(
    setupIntentId: string,
    finalizeSetupIntentDto: FinalizeSetupIntentDto,
  ): Promise<Stripe.PaymentIntent> {
    const setupIntent = await this.stripeClient.setupIntents.retrieve(setupIntentId, {
      expand: ['payment_method'],
    })
    if (!setupIntent.payment_method || typeof setupIntent.payment_method === 'string') {
      throw new BadRequestException('Payment method is missing from setup intent')
    }
    const paymentMethod = setupIntent.payment_method
    if (!paymentMethod?.billing_details?.email) {
      throw new BadRequestException('Email is required from the payment method')
    }
    const email = paymentMethod.billing_details.email

    let customer = await this.stripeClient.customers
      .list({
        email,
      })
      .then((res) => res.data.at(0))
    if (!customer) {
      customer = await this.stripeClient.customers.create({
        email,
        payment_method: paymentMethod.id,
      })
    }

    const paymentIntent = await this.stripeClient.paymentIntents.create({
      amount: finalizeSetupIntentDto.amount,
      currency: finalizeSetupIntentDto.currency,
      customer: customer.id,
      payment_method: setupIntent.payment_method.id,
      confirm: true,
    })
    return paymentIntent
  }
  /**
   * Create a setup intent for a donation
   * @param inputDto Payment intent create params
   * @returns {Promise<Stripe.Response<Stripe.PaymentIntent>>}
   */
  async createSetupIntent(): Promise<Stripe.Response<Stripe.SetupIntent>> {
    return await this.stripeClient.setupIntents.create({
      usage: 'on_session',
    })
  }

  /**
   * Create a payment intent for a donation
   * @param inputDto Payment intent create params
   * @returns {Promise<Stripe.Response<Stripe.PaymentIntent>>}
   */
  async createPaymentIntent(
    inputDto: Stripe.PaymentIntentCreateParams,
  ): Promise<Stripe.Response<Stripe.PaymentIntent>> {
    return await this.stripeClient.paymentIntents.create(inputDto)
  }

  /**
   * Update a payment intent for a donation
   * https://stripe.com/docs/api/payment_intents/update
   * @param inputDto Payment intent create params
   * @returns {Promise<Stripe.Response<Stripe.PaymentIntent>>}
   */
  async updatePaymentIntent(
    id: string,
    inputDto: Stripe.PaymentIntentUpdateParams,
  ): Promise<Stripe.Response<Stripe.PaymentIntent>> {
    return this.stripeClient.paymentIntents.update(id, inputDto)
  }

  /**
   * Cancel a payment intent for a donation
   * https://stripe.com/docs/api/payment_intents/cancel
   * @param inputDto Payment intent create params
   * @returns {Promise<Stripe.Response<Stripe.PaymentIntent>>}
   */
  async cancelPaymentIntent(
    id: string,
    inputDto: Stripe.PaymentIntentCancelParams,
  ): Promise<Stripe.Response<Stripe.PaymentIntent>> {
    return this.stripeClient.paymentIntents.cancel(id, inputDto)
  }

  async listPrices(type?: Stripe.PriceListParams.Type, active?: boolean): Promise<Stripe.Price[]> {
    const listResponse = await this.stripeClient.prices.list({ active, type, limit: 100 }).then(
      function (list) {
        Logger.debug('[Stripe] Prices received: ' + list.data.length)
        return { list }
      },
      function (error) {
        if (error instanceof Stripe.errors.StripeError)
          Logger.error(
            '[Stripe] Error while getting price list. Error type: ' +
              error.type +
              ' message: ' +
              error.message +
              ' full error: ' +
              JSON.stringify(error),
          )
      },
    )

    if (listResponse) {
      return listResponse.list.data.filter((price) => price.active)
    } else return new Array<Stripe.Price>()
  }
}
