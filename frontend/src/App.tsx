import {Box, Container, CssBaseline} from '@mui/material';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {useQueryClient} from '@tanstack/react-query';
import {useEffect} from 'react';
import AppBar from "./components/AppBar.tsx";
import Loading from "./components/Loading.tsx";
import SignIn from "./components/SignIn.tsx";
import ShareCodeRedeemer from "./components/ShareCodeRedeemer.tsx";
import GroceryList from "./components/GroceryList.tsx";
import { ToastProvider } from './components/Toast.tsx';
import useLocalStorage from './hooks/useLocalStorage.ts';
import useSessionUser, {type SessionUser} from './hooks/useSessionUser.ts';
import OfflineCacheProvider from './components/OfflineCacheProvider.tsx';
import OfflineNotice from './components/OfflineNotice.tsx';
import {clearOfflineCache} from './offlineCache.ts';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#42b883',
        },
    },
});

export default function AppWrapper() {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline/>
            <ToastProvider>
                <App />
            </ToastProvider>
        </ThemeProvider>
    );
}

function App() {
    const {user, isPending} = useSessionUser();

    if (isPending) {
        return <Loading />;
    }
    if (!user) {
        return <SignedOut />;
    }

    return (
        <OfflineCacheProvider userId={user.id}>
            <InternalApp user={user} />
        </OfflineCacheProvider>
    );
}

// Signing out, or a session that ended, must not leave the user's lists saved on this device.
function SignedOut() {
    const queryClient = useQueryClient();

    useEffect(() => {
        clearOfflineCache(queryClient);
    }, [queryClient]);

    return <SignIn />;
}

function InternalApp({user}: {user: SessionUser}) {
    const [selectedListId, setSelectedListId] = useLocalStorage(`${user.id}.selectedListId`, 'mine');

    return (
        <Container maxWidth="sm" sx={{mt: 2, pb: 14}}>
            <ShareCodeRedeemer onListRedeemed={setSelectedListId} />
            <AppBar selectedListId={selectedListId} onListChange={setSelectedListId} />
            <OfflineNotice />
            <ListCard>
                <GroceryList listId={selectedListId} />
            </ListCard>
        </Container>
    )
}

// On wider screens the list is a narrow column, so a card sets it apart from the page.
function ListCard({children}: {children: React.ReactNode}) {
    return (
        <Box sx={{
            border: {sm: 1},
            borderColor: {sm: 'divider'},
            borderRadius: {sm: 2},
            bgcolor: {sm: 'background.paper'},
            px: {sm: 2},
            pb: {sm: 1},
        }}>
            {children}
        </Box>
    );
}
