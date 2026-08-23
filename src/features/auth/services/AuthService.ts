import { SignUpFormData } from "../schemas/authSchema";

class AuthService {
    async register(credentials: SignUpFormData){
        const {name, email, password} = credentials
        
    }
}

export const authService = new AuthService();