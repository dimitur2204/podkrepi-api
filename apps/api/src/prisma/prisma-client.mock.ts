import 'jest-extended'
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended'

import prisma from './prisma-client'
import { PrismaService } from './prisma.service'

// Needed for mocking prisma to not make real requests to database
jest.mock('./prisma-client', () => ({
  __esModule: true,
  default: mockDeep<PrismaService>(),
}))

beforeEach(() => {
  mockReset(prismaMock)
})

export const prismaMock = prisma as DeepMockProxy<PrismaService>

export const MockPrismaService = {
  provide: PrismaService,
  useValue: prismaMock,
}
