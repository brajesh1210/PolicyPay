import { MerchantReputation, Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { NotFoundError, ConflictError } from "../utils/errors";

export interface CreateMerchantInput {
  name: string;
  domain: string;
  category: string;
  reputation?: MerchantReputation;
}

export class MerchantsService {
  async list(reputation?: MerchantReputation, search?: string) {
    const where: Prisma.MerchantWhereInput = {};

    if (reputation) {
      where.reputation = reputation;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { domain: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    return prisma.merchant.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(id: string) {
    const merchant = await prisma.merchant.findUnique({
      where: { id },
    });

    if (!merchant) {
      throw new NotFoundError("Merchant not found");
    }

    return merchant;
  }

  async create(input: CreateMerchantInput) {
    const existing = await prisma.merchant.findUnique({
      where: { domain: input.domain },
    });

    if (existing) {
      throw new ConflictError("Merchant with this domain already exists");
    }

    return prisma.merchant.create({
      data: {
        name: input.name,
        domain: input.domain,
        category: input.category,
        reputation: input.reputation || MerchantReputation.UNKNOWN,
      },
    });
  }

  async updateReputation(id: string, reputation: MerchantReputation) {
    await this.getById(id);

    return prisma.merchant.update({
      where: { id },
      data: { reputation },
    });
  }

  async delete(id: string) {
    await this.getById(id);

    return prisma.merchant.delete({
      where: { id },
    });
  }
}

export const merchantsService = new MerchantsService();
