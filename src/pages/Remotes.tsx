import { useEffect, useRef, useState } from 'react'
import { Input, Center, Stack, Heading, Button } from '@chakra-ui/react'

import { invoke } from "@tauri-apps/api"

const isServiceStopped = async () => {
    return await invoke<string>("get_option", {key: "stop-service"}) === "Y"
}
const isRendezvousServiceStopped = async () => {
    return await invoke<string>("get_option", {key: "stop-rendezvous-service"}) === "Y"
}

const Remotes = () => {    
    const [remoteId, setRemoteId] = useState<string>('')
    const [serviceStopped, setServiceStopped] = useState<boolean>()
    const [rendezvousServiceStopped, setRendezvousServiceStopped] = useState<boolean>(false)
    const [usingPublicServer, setUsingPublicServer] = useState<boolean>()
    const [connectStatus, setConnectStatus] = useState<number>()
    const [keyConfirmed, setKeyConfirmed] = useState<boolean>()
    const [myId, setMyId] = useState<string>("")
    const [systemError, setSystemError] = useState<string>('')
    const [softwareUpdateUrl, setSoftwareUpdateUrl] = useState<string>('')
    const [enter, setEnter] = useState<boolean>(false)
    
    const refContainer = useRef() as React.MutableRefObject<HTMLInputElement>
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const updateId = async () => {
        setMyId(await invoke<string>("get_session_id_ipc"))
    }

    // TODO:
    // const onMouse = (evt: any) => {     
    //     switch(evt.type) {           
    //     case Event.MOUSE_ENTER:    
    //         setEnter(true);
    //         check_if_overlay();
    //         break;
    //     case Event.MOUSE_LEAVE:
    //         // $(#overlay).style#display = 'none';
    //         setEnter(false);
    //         break;
    //     }
    // }
    
    const tick = async () => {
        let tmp = await isServiceStopped()
        if (tmp !== serviceStopped) {
            setServiceStopped(tmp)
            // app.update();
        }
        tmp = await isRendezvousServiceStopped()
        if (tmp !== rendezvousServiceStopped) {
            setRendezvousServiceStopped(tmp)
            // myIdMenu.update();
        }
        tmp = await invoke<boolean>("using_public_server") 
        if (tmp !== usingPublicServer) {
            setUsingPublicServer(tmp)
            // app.connect_status.update();
        }
        let tmp_tuple = await invoke<any>("get_connect_status") 
        if (tmp_tuple[0] !== connectStatus) {
            setConnectStatus(tmp_tuple[0])
            // app.connect_status.update();
        }
        if (tmp_tuple[1] !== keyConfirmed) {
            setKeyConfirmed(tmp_tuple[1])
            // app.update();
        }
        if (tmp_tuple[2] && tmp_tuple[2] !== myId) {
            console.log("id updated");
            // app.update();
        }
        let tmp_str = await invoke<string>("get_error");
        if (tmp_str !== systemError) {
            setSystemError(tmp_str)
            // app.update();
        }
        tmp_str = await invoke<string>("get_software_update_url");
        if (tmp_str !== softwareUpdateUrl) {
            setSoftwareUpdateUrl(tmp_str);
            // app.update();
        }
        if (await invoke<boolean>("recent_sessions_updated")) {
            console.log("recent sessions updated");
            // updateAbPeer();
            // app.update();
        }
        check_if_overlay();
        checkConnectStatus();    
    }

    const checkConnectStatus = () => {
        console.log("checkConnectStatus");
        invoke('check_mouse_time')// trigger connection status updater
        setTimeout(tick, 1000);
    }

    const check_if_overlay = async () => {
        if (await invoke<string>("get_option", {key: 'allow-remote-config-modification'}) === "") {
            var time0 = new Date().getDate()
            // TODO: inspect why it dont work
            await invoke("check_mouse_time")
            
            setTimeout(async () => {
                if (!enter) return;
                var d = time0 - await invoke<number>("get_mouse_time");
                if (d < 120) {
                    console.log("(#overlay).style#display = 'block'")
                    // $(#overlay).style#display = 'block';
                }
            }, 120);
        }
    }
    
    useEffect(() => {
        const listenEvents = async () => {
            console.log("listenEvents");
            setServiceStopped(await isServiceStopped())
            setRendezvousServiceStopped(await isRendezvousServiceStopped())
            setUsingPublicServer(await invoke<boolean>("using_public_server"))

            
            let tmp_tuple = await invoke<any>("get_connect_status") 
            setConnectStatus(tmp_tuple[0])
            setKeyConfirmed(tmp_tuple[1])
            checkConnectStatus()
            console.log("listenEvents");
        }


        const unlisten = listenEvents().catch(() => null)

        return () => {
            unlisten.then((unl) => {    
                console.log(unl)  
            }) 
         }
    }, [])

    useEffect(() => {
        const listenEvents = async () => {
            let is_can_screen_recording = await invoke<boolean>("is_can_screen_recording", {_prompt: "false"})

            if (keyConfirmed) {
                await updateId()
            }

            if (is_can_screen_recording) {
                // TODO: CanScreenRecording
            }
            
        }
        const unlisten = listenEvents().catch(() => null)

        return () => {
            unlisten.then() 
         }
    })

    // This function calculate X and Y
    const getPosition = () => {
        setDimensions({
            width: refContainer.current.offsetWidth,
            height: refContainer.current.offsetHeight,
        })
    };

    // Get the position of the red box in the beginning
    useEffect(() => {
        getPosition()
    }, []);

    // Re-calculate W and H when the window gets resized by the user
    useEffect(() => {
        window.addEventListener("resize", getPosition)
    }, []);
    
    window.addEventListener("beforeunload", async (ev) => {  
        
        // TODO: get real x, y coords 
        await invoke("closing", {x: 0, y: 0, w: dimensions.width, h: dimensions.height})
        console.log(dimensions.width, dimensions.height)
    });

    const createNewConnect = (id: string, type: string) => {
        const _id = id.replace(/\s/g, "")
        if (!_id) return
        // TODO where I can find my_id?
        // if (_id === my_id)
    
        invoke('set_remote_id', { id: _id }).then(console.log)
        invoke('new_remote', { id: _id, remoteType: type }).then(console.log)
    }

    return (
        <div ref={refContainer}>
            <Center h='100vh'>
                <Stack spacing='12px'>
                    <Heading>Control remote desktop</Heading>
                    <Input
                        value={remoteId}
                        onChange={e => {
                            setRemoteId(e.target.value)
                        }} />
                    <Button onClick={() => createNewConnect(remoteId, 'connect')}>Connect</Button>
                </Stack>
            </Center>
        </div>
    )
}

export default Remotes
