import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import Snackbar from '@mui/material/Snackbar';
import { AlertColor } from '@mui/material/Alert';
import { Slide, SlideProps, Paper, useTheme, Theme } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ToastContextProps {
    showToast: (message: string, severity?: AlertColor) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

interface ToastState {
    open: boolean;
    message: string;
    severity: AlertColor;
}

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toast, setToast] = useState<ToastState>({ open: false, message: '', severity: 'info' });
    const theme = useTheme();
    const { t } = useTranslation();
    const showToast = useCallback((message: string, severity: AlertColor = 'info') => {
        setToast({ open: true, message, severity });
    }, []);

    const handleClose = (_: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setToast((prev) => ({ ...prev, open: false }));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <Snackbar
                open={toast.open}
                autoHideDuration={6000}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                slots={{transition: SlideTransition}}
                sx={{ bottom: { xs: 100, sm: 0 } }}
            >
                <Paper
                    elevation={6}
                    sx={{
                        width: '100%',
                        p: 2,
                        borderBottom: `4px solid ${getBorderColor(toast.severity, theme)}`,
                        bgcolor: 'background.paper',
                    }}
                >
                    {t(toast.message)}
                </Paper>
            </Snackbar>
        </ToastContext.Provider>
    );
};

function SlideTransition(props: SlideProps) {
    return <Slide {...props} direction="up" />;
}

const getBorderColor = (severity: AlertColor, theme: Theme) => {
    switch (severity) {
        case 'success': return theme.palette.success.main;
        case 'error': return theme.palette.error.main;
        case 'warning': return theme.palette.warning.main;
        case 'info': return theme.palette.info.main;
        default: return theme.palette.info.main;
    }
};

export const useToast = (): ToastContextProps => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
