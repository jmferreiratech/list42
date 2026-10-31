import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
    Autocomplete,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Collapse,
    Fab,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Slide,
    Tab,
    Tabs,
    TextField,
    Typography
} from '@mui/material';
import { createId } from '@paralleldrive/cuid2';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TransitionGroup } from "react-transition-group";
import api, { GroceryItem } from '../api';
import { HorizontalSwipeRegion } from './SwipeRegion.tsx';
import { useToast } from './Toast.tsx';

// Picks up changes made by the other person on a shared list.
const LIST_POLLING_INTERVAL_MS = 30_000;

export default function GroceryList({ listId = 'mine' }: { listId?: string }) {
    const { t } = useTranslation();
    const [editingItemId, setEditingItemId] = useState<GroceryItem['id'] | null>(null);
    const [activeTab, setActiveTab] = useState(0);
    // Only animate the list once the user switches tabs, not when it first appears.
    const hasSwitchedTab = useRef(false);
    const tabRegionRef = useRef<HTMLDivElement>(null);
    const [completedSearch, setCompletedSearch] = useState('');
    const {
        items,
        addItem,
        updateItem,
        deleteItem,
        isLoading,
        hasLoadFailed,
        retryLoad,
    } = useItemsList(listId);

    const handleDelete = (id: GroceryItem['id']) => {
        deleteItem(id);
        if (editingItemId === id) {
            setEditingItemId(null);
        }
    };

    const handleSave = async (id: GroceryItem['id'], name: GroceryItem['name']) => {
        await updateItem(id, { name });

        if (id.startsWith('new')) {
            const newId = addItem();
            setEditingItemId(newId);
        } else {
            setEditingItemId(null);
        }
    };

    const handleAdd = () => {
        const newId = addItem();
        setEditingItemId(newId);
        switchTab(0);
    };

    const handleToggle = (id: GroceryItem['id'], completed: GroceryItem['completed']) => {
        updateItem(id, { completed: !completed });
        if (editingItemId === id)
            setEditingItemId(null);
    };

    const switchTab = (tab: number) => {
        hasSwitchedTab.current = true;
        setActiveTab(tab);
    };

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        switchTab(newValue);
    };

    const filteredItems = activeTab === 0
        ? items.filter(item => !item.completed)
        : searchCompletedItems(items, completedSearch);
    const savedItems = items.filter(item => !item.id.startsWith('new'));
    const pendingCount = savedItems.filter(item => !item.completed).length;
    const completedCount = savedItems.length - pendingCount;

    return (
        <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    aria-label="grocery list tabs"
                    variant="fullWidth"
                    sx={{ width: '100%' }}
                >
                    <Tab label={`${t('pending')} (${pendingCount})`} id="pending-tab" aria-controls="pending-panel" />
                    <Tab label={`${t('completed')} (${completedCount})`} id="completed-tab" aria-controls="completed-panel" />
                </Tabs>
            </Box>
            {activeTab === 1 && (
                <TextField
                    type="search"
                    size="small"
                    fullWidth
                    value={completedSearch}
                    onChange={event => setCompletedSearch(event.target.value)}
                    placeholder={t('searchCompleted')}
                    slotProps={{ htmlInput: { 'aria-label': t('searchCompleted') } }}
                />
            )}
            <Box ref={tabRegionRef} sx={{ overflow: 'hidden' }}>
                <HorizontalSwipeRegion onChange={val => switchTab(val === 'left' ? 1 : 0)}>
                    <Slide
                        key={activeTab}
                        in
                        appear={hasSwitchedTab.current}
                        direction={activeTab === 1 ? 'left' : 'right'}
                        container={tabRegionRef.current}
                    >
                        <Box>
                            <ListStatus
                                isLoading={isLoading}
                                hasLoadFailed={hasLoadFailed}
                                isEmpty={filteredItems.length === 0}
                                emptyMessage={t(emptyMessageKey(activeTab, completedSearch))}
                                onRetry={retryLoad}
                            />
                            <List>
                                <TransitionGroup>
                                    {filteredItems.map((item) => (
                                        <Collapse key={item.id}>
                                            {
                                                editingItemId === item.id ? (
                                                    <EditingItem
                                                        item={item}
                                                        onSave={handleSave}
                                                        handleDeleteItem={handleDelete}
                                                        handleToggleComplete={(id, value) => handleToggle(id, value)}
                                                        selectedList={listId}
                                                    />
                                                ) : (
                                                    <Item
                                                        item={item}
                                                        handleToggleComplete={() => handleToggle(item.id, item.completed)}
                                                        handleDeleteItem={handleDelete}
                                                        setEditingItemId={setEditingItemId}
                                                    />
                                                )
                                            }
                                        </Collapse>
                                    ))}
                                </TransitionGroup>
                            </List>
                        </Box>
                    </Slide>
                </HorizontalSwipeRegion>
            </Box>
            <Fab
                color="primary"
                aria-label={t('addItem')}
                sx={{position: 'fixed', bottom: 32, right: 32}}
                onClick={handleAdd}
                disabled={editingItemId !== null && items.length > 0 && items[0].id === editingItemId && items[0].name.trim() === ''}
            >
                <AddIcon/>
            </Fab>
        </>
    )
}

// Completed items act as a history, so they are listed by name instead of by date.
function searchCompletedItems(items: GroceryItem[], search: string): GroceryItem[] {
    const query = normalizeItemName(search);
    return items
        .filter(item => item.completed && normalizeItemName(item.name).includes(query))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
}

function emptyMessageKey(activeTab: number, completedSearch: string): string {
    if (activeTab === 0) {
        return 'emptyPending';
    }
    return completedSearch.trim() === '' ? 'emptyCompleted' : 'noSearchResults';
}

interface ListStatusProps {
    isLoading: boolean;
    hasLoadFailed: boolean;
    isEmpty: boolean;
    emptyMessage: string;
    onRetry: () => void;
}

function ListStatus({ isLoading, hasLoadFailed, isEmpty, emptyMessage, onRetry }: ListStatusProps) {
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress aria-label={t('loading')} />
            </Box>
        );
    }

    if (hasLoadFailed) {
        return (
            <Box role="alert" sx={{ textAlign: 'center', py: 4 }}>
                <Typography sx={{ mb: 2 }}>{t('loadListError')}</Typography>
                <Button variant="outlined" onClick={onRetry}>{t('retry')}</Button>
            </Box>
        );
    }

    if (isEmpty) {
        return (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                {emptyMessage}
            </Typography>
        );
    }

    return null;
}

interface ItemProps {
    item: GroceryItem;
    handleToggleComplete: (id: GroceryItem['id']) => void;
    handleDeleteItem: (id: GroceryItem['id']) => void;
    setEditingItemId: (id: GroceryItem['id']) => void;
}

function Item({ item, handleToggleComplete, handleDeleteItem, setEditingItemId }: ItemProps) {
    const { t } = useTranslation();

    return (
        <ListItem
            secondaryAction={
                <IconButton
                    edge="end"
                    aria-label={t('deleteItem', { name: item.name })}
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
                disableRipple
                inputProps={{ 'aria-labelledby': `list-item-label-${item.id}` }}
                onChange={() => handleToggleComplete(item.id)}
            />
            <ListItemButton
                aria-label={t('editItem', { name: item.name })}
                onClick={() => setEditingItemId(item.id)}
                sx={{ px: 1 }}
            >
                <ListItemText
                    id={`list-item-label-${item.id}`}
                    primary={item.name || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>{t('enterItemName')}</span>}
                    sx={{
                        textDecoration: item.completed ? 'line-through' : 'none',
                        color: item.completed ? 'text.secondary' : 'text.primary',
                    }}
                />
            </ListItemButton>
        </ListItem>
    );
}

function useItemsList(listId: string = 'mine') {
    const { showToast } = useToast();
    const [tempItem, setTempItem] = useState<GroceryItem | null>(null);
    const { data: groceryListData, isLoading, isError, refetch } = api.endpoints.getGroceryList.useQuery(
        { id: listId },
        { pollingInterval: LIST_POLLING_INTERVAL_MS, skipPollingIfUnfocused: true, refetchOnFocus: true },
    );
    const [addGroceryListItem, { isLoading: isAdding }] = api.endpoints.addItem.useMutation();
    const [updateGroceryListItem, { isLoading: isUpdating }] = api.endpoints.updateItem.useMutation();
    const [deleteGroceryListItem, { isLoading: isDeleting }] = api.endpoints.deleteItem.useMutation();

    const savedItems = groceryListData?.items || [];

    const sortItemsByUpdatedAt = (items: GroceryItem[]): GroceryItem[] => {
        return [...items].sort((a, b) => {
            if (!a.updatedAt) return -1;

            if (!b.updatedAt) return 1;

            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    };

    const items = tempItem ? [tempItem, ...sortItemsByUpdatedAt(savedItems)] : sortItemsByUpdatedAt(savedItems);

    const addItem = (): GroceryItem['id'] => {
        const newItem: GroceryItem = {
            id: `new-${createId()}`,
            name: '',
            completed: false,
        };

        setTempItem(newItem);

        return newItem.id;
    };

    const deleteItem = async (id: GroceryItem['id']) => {
        if (id.startsWith('new') && tempItem) {
            setTempItem(null);
            return;
        }

        const itemToDelete = savedItems.find(item => item.id === id);
        if (itemToDelete) {
            try {
                await deleteGroceryListItem({ id: listId, item: itemToDelete }).unwrap();
                showToast('itemDeleted', 'info', { label: 'undo', onClick: () => restoreItem(itemToDelete) });
            } catch (error) {
                console.error('Failed to delete item:', error);
                showToast('deleteItemError', 'error');
            }
        }
    };

    // Saving an item with its original id brings it back, since the API overwrites items by id.
    const restoreItem = async (item: GroceryItem) => {
        try {
            await addGroceryListItem({ id: listId, item }).unwrap();
        } catch (error) {
            console.error('Failed to restore item:', error);
            showToast('addItemError', 'error');
        }
    };

    const updateItem = async (id: GroceryItem['id'], updates: Partial<Omit<GroceryItem, 'id'>>) => {
        if (id.startsWith('new') && tempItem) {
            const updatedTempItem = { ...tempItem, ...updates };

            setTempItem(updatedTempItem);

            if (updates.name !== undefined && updates.name.trim() !== '') {
                const itemToSave = {
                    ...updatedTempItem,
                    id: createId()
                };

                try {
                    await addGroceryListItem({ id: listId, item: itemToSave }).unwrap();
                    setTempItem(null);
                } catch (error) {
                    console.error('Failed to add item:', error);
                    showToast('addItemError', 'error');
                }
            }
            return;
        }

        const existingItem = savedItems.find(item => item.id === id);
        if (existingItem) {
            const updatedItem = { ...existingItem, ...updates };

            const hasChanged = Object.keys(updates).some(key => {
                return updates[key as keyof typeof updates] !== existingItem[key as keyof typeof existingItem];
            });

            if (hasChanged) {
                try {
                    await updateGroceryListItem({ id: listId, item: updatedItem }).unwrap();
                } catch (error) {
                    console.error('Failed to update item:', error);
                    showToast('updateItemError', 'error');
                }
            }
        }
    };

    return {
        items,
        addItem,
        updateItem,
        deleteItem,
        isLoading,
        isUpdating: isAdding || isUpdating || isDeleting,
        hasLoadFailed: isError && !groceryListData,
        retryLoad: refetch,
    };
}

interface EditingItemProps {
    item: GroceryItem;
    onSave: (id: GroceryItem['id'], name: GroceryItem['name']) => Promise<void>;
    handleDeleteItem: (id: GroceryItem['id']) => void;
    handleToggleComplete: (id: GroceryItem['id'], currentValue: boolean) => void;
    selectedList: string;
}

function EditingItem({
    item,
    onSave,
    handleDeleteItem,
    handleToggleComplete,
    selectedList,
}: EditingItemProps) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [currentName, setCurrentName] = useState(item.name);
    const { data: groceryListData } = api.endpoints.getGroceryList.useQuery({ id: selectedList });
    const saveInProgress = useRef(false);
    // The Enter key press that opens this editor from the keyboard ends with a keyup here.
    // Only save on an Enter whose keydown also reached this input.
    const enterPressedHere = useRef(false);

    const suggestions = useMemo(() => {
        if (!groceryListData?.items) return [];
        return Array.from(new Set(
            groceryListData.items.filter(item => item.completed).map(item => item.name)
        )).filter(name => name.trim() !== '');
    }, [groceryListData]);
    
    const saveChanges =  async () => {
        if (saveInProgress.current)
             return;

        saveInProgress.current = true;
        
        const trimmedName = currentName.trim();
        if (trimmedName === '') {
            handleDeleteItem(item.id);
        } else if (!reuseExistingItem(trimmedName)) {
            await onSave(item.id, trimmedName);
        }
        
        setTimeout(() => {
            saveInProgress.current = false;
        }, 100);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            enterPressedHere.current = true;
        }
    };

    const handleKeyUp = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && enterPressedHere.current) {
            enterPressedHere.current = false;
            saveChanges();
        }
    };

    const handleAutocompleteChange = (_: React.SyntheticEvent, value: string | null) => {
        if (value) {
            setCurrentName(value);
            reuseExistingItem(value);
        }
    };

    // Returns whether another item already has this name, ignoring case and accents.
    // A completed match goes back to pending instead of creating a duplicate.
    const reuseExistingItem = (name: string): boolean => {
        const existingItem = groceryListData?.items.find(i => i.id !== item.id && isSameItemName(i.name, name));
        if (!existingItem) {
            return false;
        }

        if (existingItem.completed) {
            handleToggleComplete(existingItem.id, existingItem.completed);
        } else {
            showToast('itemAlreadyPending', 'info');
        }
        setCurrentName('');
        return true;
    };

    return (
        <ListItem
            secondaryAction={
                <IconButton
                    edge="end"
                    aria-label={t('deleteItem', { name: item.name })}
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
                onClick={() => handleToggleComplete(item.id, item.completed)}
                disabled
            />

            <Autocomplete
                freeSolo
                value={currentName}
                disableClearable
                clearOnBlur
                onChange={handleAutocompleteChange}
                onInputChange={(_, newInputValue) => {
                    setCurrentName(newInputValue);
                }}
                options={suggestions}
                // MUI passes an empty inputValue right after the popup opens, because `value` mirrors the typed text.
                filterOptions={options => filterSuggestions(options, currentName)}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        variant="standard"
                        fullWidth
                        placeholder={t('enterItemName')}
                        sx={{ ml: 1 }}
                        onBlur={saveChanges}
                        onKeyDown={handleKeyDown}
                        onKeyUp={handleKeyUp}
                        autoFocus
                    />
                )}
                sx={{ width: '100%', ml: 1 }}
            />

        </ListItem>
    );
}

// Keeps names with a word starting with the typed text, listing names that start with it first.
function filterSuggestions(names: string[], typed: string): string[] {
    const query = normalizeItemName(typed);
    const startsName = (name: string) => normalizeItemName(name).startsWith(query);
    const startsAWord = (name: string) => normalizeItemName(name).split(/\s+/).some(word => word.startsWith(query));

    return [
        ...names.filter(startsName),
        ...names.filter(name => !startsName(name) && startsAWord(name)),
    ];
}

function isSameItemName(a: string, b: string): boolean {
    return normalizeItemName(a) === normalizeItemName(b);
}

function normalizeItemName(name: string): string {
    return name.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
}
