import { GlobalConfig } from "@prisma/client";
import { prisma } from "../config/database";

export class GlobalConfigService {
  async getConfig(): Promise<GlobalConfig> {
    const config = await prisma.globalConfig.findUnique({
      where: { id: "global" },
    });

    if (config) {
      return config;
    }

    return prisma.globalConfig.create({
      data: {
        id: "global",
        killSwitchActive: false,
      },
    });
  }

  async setKillSwitch(active: boolean): Promise<GlobalConfig> {
    return prisma.globalConfig.upsert({
      where: { id: "global" },
      update: { killSwitchActive: active },
      create: { id: "global", killSwitchActive: active },
    });
  }
}

export const globalConfigService = new GlobalConfigService();
