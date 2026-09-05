import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type WaProvider = "cloud" | "green";

export type WaAccountPublic = {
  id: string;
  venueId: string | null;
  provider: WaProvider;
  instance: string;
  displayPhone: string;
  templateOwner: string;
  templatePlayer: string;
  verifyTokenSet: boolean;
  tokenSet: boolean;
  enabled: boolean;
  connected: boolean;
};

export const getWaAccount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { readWaAccount } = await import("./whatsapp.server");
    return readWaAccount(context.userId);
  });

export const saveWaAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    provider: WaProvider;
    token?: string;
    instance: string;
    displayPhone: string;
    templateOwner?: string;
    templatePlayer?: string;
    verifyToken?: string;
    enabled: boolean;
  }) => input)
  .handler(async ({ context, data }) => {
    const { writeWaAccount } = await import("./whatsapp.server");
    return writeWaAccount(context.userId, data);
  });

export const testWaSend = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { phone: string }) => input)
  .handler(async ({ context, data }) => {
    const { pingWaTest } = await import("./whatsapp.server");
    return pingWaTest(context.userId, data.phone);
  });

export const listWaOutbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { readWaOutbox } = await import("./whatsapp.server");
    return readWaOutbox(context.userId);
  });
