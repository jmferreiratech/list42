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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

interface GroceryItem {
    id: number;
    name: string;
    completed: boolean;
}

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});

export default function App() {
    const listName = 'Minha lista de compras';
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
        <ThemeProvider theme={darkTheme}>
            <CssBaseline/>
            <Container maxWidth="sm" sx={{mt: 4, pb: 10}}>
                <Typography variant="h4" component="h1" gutterBottom align="center">{listName}</Typography>
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
            </Container>
        </ThemeProvider>
    );
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
    const [items, setItems] = useState<GroceryItem[]>(() => {
        const savedItems = localStorage.getItem('groceryListItems');
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
        try {
            localStorage.setItem('groceryListItems', JSON.stringify(items));
        } catch (error) {
            console.error("Failed to save items to localStorage", error);
        }
    }, [items]);

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
