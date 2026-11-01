import CloudOffIcon from '@mui/icons-material/CloudOff';
import { Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import useIsOnline from '../hooks/useIsOnline.ts';

export default function OfflineNotice() {
    const { t } = useTranslation();
    const isOnline = useIsOnline();

    if (isOnline) {
        return null;
    }

    return (
        <Alert severity="info" icon={<CloudOffIcon />} role="status" sx={{ mb: 2 }}>
            {t('offline')}
        </Alert>
    );
}
