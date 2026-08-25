import { db } from "@/src/db";
import { eq } from "drizzle-orm";
import { users } from "@/src/db/schema/auth";
import { User } from "../types/auth.types";

export interface IAuthRepository {
    userExists(email: string): Promise<User | undefined>
}

class AuthRepository implements IAuthRepository {
    async userExists(email: string) {
        return await db.query.users.findFirst({
            where: eq(users.email, email)
        })
    }
}

export const authRepository = new AuthRepository();