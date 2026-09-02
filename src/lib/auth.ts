import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '../db/index';
import { AuthEmailService } from '../emails/services/AuthEmailService';

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg',
        usePlural: true
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        sendResetPassword: async ({user, url}) => {
            await AuthEmailService.sendPasswordResetToken({
                name: user.name,
                email: user.email,
                url
            })
        }
    },
    emailVerification: {
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
            await AuthEmailService.sendVerificationEmail({
                name: user.name,
                email: user.email,
                url
            })
        },
    },
    plugins: [nextCookies()]
})
