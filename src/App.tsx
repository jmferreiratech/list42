import {Container, CssBaseline} from '@mui/material';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {type Session} from './auth';
import AppBar from "./components/AppBar.tsx";
import Loading from "./components/Loading.tsx";
import SignIn from "./components/SignIn.tsx";
import ShareCodeRedeemer from "./components/ShareCodeRedeemer.tsx";
import GroceryList from "./components/GroceryList.tsx";
import { ToastProvider } from './components/Toast.tsx';
import useLocalStorage from './hooks/useLocalStorage.ts';
import { useAuth } from './components/Auth.tsx';

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
    const authClient = useAuth();
    const {data, isPending} = authClient.useSession();

    if (isPending) {
        return <Loading />;
    }
    if (!data?.session) {
        return <SignIn />;
    }

    return <InternalApp user={data.user} />;
}

function InternalApp({user}: {user: Session['user']}) {
    const [selectedListId, setSelectedListId] = useLocalStorage(`${user.id}.selectedListId`, 'mine');

    return (
        <Container maxWidth="sm" sx={{mt: 2, pb: 10}}>
            <ShareCodeRedeemer onListRedeemed={setSelectedListId} />
            <AppBar selectedListId={selectedListId} onListChange={setSelectedListId} />
            <GroceryList listId={selectedListId} />
        </Container>
    )
}
