export const emailConfig = {
    from: {
        verification: 'Finances <cuentas@finances.com>',
        passwordReset: 'Finances <admin@finances.com>',
        default: 'Finances <noreply@finances.com>'
    },
    tokenExpiration: '1 hora'
} as const