import { createContext, ReactNode, useContext } from "react";
import { AuthClient } from "../auth";

const AuthContext = createContext<AuthClient | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode, client: AuthClient }> = ({ children, client }) => {

    return (
        <AuthContext.Provider value={client}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within a ToastProvider');
    }
    return context;
};
