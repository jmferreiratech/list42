import {useState, useEffect} from 'react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {
    Container,
    Typography,
    TextField,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Checkbox,
    CssBaseline,
    Fab,
    Box,
    Paper,
    Toolbar,
    CircularProgress,
} from '@mui/material';
import MuiAppBar from '@mui/material/AppBar';
import authClient from './auth';
import LoginButton from './components/LoginButton';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AppBar from "./components/AppBar.tsx";
import logo from '/logo.svg?url';

interface GroceryItem {
    id: number;
    name: string;
    completed: boolean;
}

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
            <App />
        </ThemeProvider>
    );
}

const listName = 'List42';

function App() {
    const {data, isPending} = authClient.useSession()

    if (isPending) {
        return (
            <Container maxWidth="sm" sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <SignInAppBar listName={listName} />
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '50vh'
                }}>
                    <CircularProgress color="primary" />
                    <Typography variant="body1" sx={{ mt: 2 }}>
                        Loading...
                    </Typography>
                </Box>
            </Container>
        );
    }

    if (!data) {
        return <SignIn/>;
    }

    return (
        <Container maxWidth="sm" sx={{mt: 2, pb: 10}}>
            <AppBar listName={listName} />
            <GroceryList/>
        </Container>
    )
}

function SignInAppBar({listName}: {listName: string}) {
    return (
        <MuiAppBar position="fixed" sx={{ mb: 2 }}>
            <Toolbar sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <img src={logo} alt="Logo" style={{ height: 24, marginRight: 8 }} />
                    <Typography variant="h6" component="h1" color="primary">
                        {listName}
                    </Typography>
                </Box>
            </Toolbar>
        </MuiAppBar>
    );
}

function SignIn() {
    return (
        <Container maxWidth="sm" sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <SignInAppBar listName={listName} />
            <Paper
                elevation={3}
                sx={{
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mt: 4
                }}
            >
                <Typography component="h1" variant="h5" gutterBottom>
                    Sign in to {listName}
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, textAlign: 'center' }}>
                    Please sign in to create and manage your grocery list.
                </Typography>
                <LoginButton />
            </Paper>
        </Container>
    );
}

function GroceryList() {
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const {
        items,
        addItem,
        updateItem,
        deleteItem,
    } = useItemsList();

    const handleDelete = (id: number) => {
        deleteItem(id);
        if (editingItemId === id) {
            setEditingItemId(null);
        }
    };

    const handleSave = (id: number, name: string) => {
        updateItem(id, { name });
        setEditingItemId(null);
    };

    const handleAdd = () => {
        const newId = addItem();
        setEditingItemId(newId);
    };

    const handleToggle = (id: number, completed: boolean) => {
        updateItem(id, { completed: !completed });
        if (editingItemId === id)
            setEditingItemId(null);
    };

    return (
        <>
            <List>
                {items.map((item) => (
                    editingItemId === item.id ? (
                        <EditingItem
                            key={item.id}
                            item={item}
                            onSave={handleSave}
                            handleDeleteItem={handleDelete}
                            handleToggleComplete={() => handleToggle(item.id, item.completed)}
                        />
                    ) : (
                        <Item
                            key={item.id}
                            item={item}
                            handleToggleComplete={() => handleToggle(item.id, item.completed)}
                            handleDeleteItem={handleDelete}
                            setEditingItemId={setEditingItemId}
                        />
                    )
                ))}
            </List>
            <Fab
                color="primary"
                aria-label="add"
                sx={{position: 'fixed', bottom: 32, right: 32}}
                onClick={handleAdd}
                disabled={editingItemId !== null && items.length > 0 && items[0].id === editingItemId && items[0].name.trim() === ''}
            >
                <AddIcon/>
            </Fab>
        </>
    )
}

interface ItemProps {
    item: GroceryItem;
    handleToggleComplete: (id: number) => void;
    handleDeleteItem: (id: number) => void;
    setEditingItemId: (id: number) => void;
}

function Item({ item, handleToggleComplete, handleDeleteItem, setEditingItemId }: ItemProps) {
    return (
        <ListItem
            secondaryAction={
                <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDeleteItem(item.id)}
                >
                    <DeleteIcon />
                </IconButton>
            }
            disablePadding
        >
            <Checkbox
                edge="start"
                checked={item.completed}
                tabIndex={-1}
                disableRipple
                inputProps={{ 'aria-labelledby': `list-item-label-${item.id}` }}
                onClick={() => handleToggleComplete(item.id)}
            />
            <ListItemText
                id={`list-item-label-${item.id}`}
                primary={item.name || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Enter item name...</span>}
                sx={{
                    textDecoration: item.completed ? 'line-through' : 'none',
                    color: item.completed ? 'text.secondary' : 'text.primary',
                    cursor: 'pointer',
                }}
                onClick={() => setEditingItemId(item.id)}
            />
        </ListItem>
    );
}

function useItemsList() {
    const {data} = authClient.useSession()

    const userId = data?.user.id || 'anonymous';
    const storageKey = `groceryListItems_${userId}`;

    const [items, setItems] = useState<GroceryItem[]>(() => {
        if (!data) return [];

        const savedItems = localStorage.getItem(storageKey);
        if (savedItems) {
            try {
                const parsedItems = JSON.parse(savedItems);
                if (Array.isArray(parsedItems)) {
                    return parsedItems as GroceryItem[];
                }
            } catch (error) {
                console.error("Failed to parse items from localStorage", error);
                return [];
            }
        }
        return [];
    });

    useEffect(() => {
        if (!data) return;

        try {
            localStorage.setItem(storageKey, JSON.stringify(items));
        } catch (error) {
            console.error("Failed to save items to localStorage", error);
        }
    }, [items, storageKey, data]);

    const addItem = (): number => {
        const newItemId = Date.now();
        const newItem: GroceryItem = {
            id: newItemId,
            name: '',
            completed: false,
        };
        setItems((prevItems) => [newItem, ...prevItems]);

        return newItemId;
    };

    const deleteItem = (id: number) => {
        setItems((prevItems) => prevItems.filter((item) => item.id !== id));
    };

    const updateItem = (id: number, updates: Partial<Omit<GroceryItem, 'id'>>) => {
        setItems(prevItems =>
            prevItems.map(item =>
                item.id === id ? { ...item, ...updates } : item
            )
        );
    };

    return {
        items,
        addItem,
        updateItem,
        deleteItem,
    };
}

interface EditingItemProps {
    item: GroceryItem;
    onSave: (id: number, name: string) => void;
    handleDeleteItem: (id: number) => void;
    handleToggleComplete: (id: number) => void;
}

function EditingItem({
    item,
    onSave,
    handleDeleteItem,
    handleToggleComplete,
}: EditingItemProps) {
    const [currentName, setCurrentName] = useState(item.name);

    const saveChanges = () => {
        const trimmedName = currentName.trim();
        if (trimmedName === '') {
            handleDeleteItem(item.id);
        } else {
            onSave(item.id, trimmedName);
        }
    };


    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            saveChanges();
        }
    };

    return (
        <ListItem
            secondaryAction={
                <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDeleteItem(item.id)}
                    disabled
                >
                    <DeleteIcon />
                </IconButton>
            }
            disablePadding
        >
            <Checkbox
                edge="start"
                checked={item.completed}
                tabIndex={-1}
                disableRipple
                inputProps={{ 'aria-labelledby': `list-item-label-${item.id}` }}
                onClick={() => handleToggleComplete(item.id)}
                disabled
            />
            <TextField
                value={currentName}
                onChange={(e) => setCurrentName(e.target.value)}
                onBlur={saveChanges}
                onKeyPress={handleKeyPress}
                autoFocus
                variant="standard"
                fullWidth
                sx={{ ml: 1 }}
                InputProps={{ disableUnderline: true }}
            />
        </ListItem>
    );
}
