import {Slide, Toolbar, Typography, useScrollTrigger, AppBar as MuiAppBar} from "@mui/material";
import UserMenu from "./UserMenu.tsx";

export default function AppBar({listName}: {listName: string}) {
    return (
        <>
        <HideOnScroll>
            <MuiAppBar position="fixed" sx={{ mb: 2 }}>
                <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" component="h1" color="primary">
                        {listName}
                    </Typography>
                    <UserMenu />
                </Toolbar>
            </MuiAppBar>
        </HideOnScroll>
        <Toolbar /> {/* This empty Toolbar acts as a spacer */}
        </>
    )
};

interface HideOnScrollProps {
    children: React.ReactElement;
}

function HideOnScroll(props: HideOnScrollProps) {
    const { children } = props;

    const trigger = useScrollTrigger();

    return (
        <Slide appear={false} direction="down" in={!trigger}>
            {children}
        </Slide>
    );
}
