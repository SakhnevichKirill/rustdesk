import { useEffect, useRef, useState } from 'react'
import { Input, Center, Stack, Heading, Button } from '@chakra-ui/react'

import { invoke } from "@tauri-apps/api"
import { TupleType } from 'typescript'

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
    const [keyConfirmed, setKeyConfirmed] = useState<boolean>(false)
    const [myId, setMyId] = useState<string>("")
    const [systemError, setSystemError] = useState<string>('')
    const [softwareUpdateUrl, setSoftwareUpdateUrl] = useState<string>('')
    const [enter, setEnter] = useState<boolean>(false)

    const [toggleConnectStatus, setToggleConnectStatus] = useState<boolean>(false)
    
    const refContainer = useRef() as React.MutableRefObject<HTMLInputElement>
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 })


    // TODO:
    // const onMouse = (evt: any) => {     
    //     switch(evt.type) {           
    //     case Event.MOUSE_ENTER:    
    //         setEnter(true)
    //         check_if_overlay()
    //         break
    //     case Event.MOUSE_LEAVE:
    //         // $(#overlay).style#display = 'none'
    //         setEnter(false)
    //         break
    //     }
    // }
    
    useEffect(() => {
        const check_if_overlay = async () => {
            if (await invoke<string>("get_option", {key: 'allow-remote-config-modification'}) === "") {
                var time0 = new Date().getDate()
                await invoke("check_mouse_time")
                
                setTimeout(async () => {
                    if (!enter) return
                    var d = time0 - await invoke<number>("get_mouse_time")
                    if (d < 120) {
                        console.log("(#overlay).style#display = 'block'")
                        // $(#overlay).style#display = 'block'
                    }
                }, 120)
            }
        }

        const tick = async () => {
            let tmp = await isServiceStopped()
            if (tmp !== serviceStopped) {
                setServiceStopped(tmp)
            }
            tmp = await isRendezvousServiceStopped()
            if (tmp !== rendezvousServiceStopped) {
                setRendezvousServiceStopped(tmp)
                // myIdMenu.update()
            }
            tmp = await invoke<boolean>("using_public_server") 
            if (tmp !== usingPublicServer) {
                setUsingPublicServer(tmp)
                // app.connect_status.update()
            }
            let tmp_tuple = await invoke<any>("get_connect_status")
            if (tmp_tuple[0] !== connectStatus) {
                setConnectStatus(tmp_tuple[0])
                // app.connect_status.update()
            }
            if (tmp_tuple[1] !== keyConfirmed) {
                console.log('KeyConfirmed', tmp_tuple[1], keyConfirmed)
                setKeyConfirmed(tmp_tuple[1])
            }
            if (tmp_tuple[2] && tmp_tuple[2].toString() !== myId) {
                console.log("id updated")
                // app.update()
            }
            let tmp_str = await invoke<string>("get_error")
            if (tmp_str !== systemError) {
                setSystemError(tmp_str)
            }
            tmp_str = await invoke<string>("get_software_update_url")
            if (tmp_str !== softwareUpdateUrl) {
                setSoftwareUpdateUrl(tmp_str)
            }
            if (await invoke<boolean>("recent_sessions_updated")) {
                console.log("recent sessions updated")
                // updateAbPeer()
                // app.update()
            }
            check_if_overlay()
            setToggleConnectStatus(current => !current)
        }

        const checkConnectStatus = () => {
            console.log('checkConnectStatus')
            invoke('check_mouse_time').then()// trigger connection status updater
            setTimeout(tick, 1000)
        }

        checkConnectStatus()

    }, [toggleConnectStatus])
    
    // TODO: App rendering
    useEffect(() => {
        // TODO: get_id function renamed to updateId, confirm the correctness of the updateId call points
        const updateId = () => {
            invoke<string>("get_session_id_ipc").then(
                (id) => {
                    console.log("updateId", id)
                    setMyId(id)
                }
            )
        }

        const listenEvents = async () => {
            console.log("keyConfirmed: ", keyConfirmed)
            if (keyConfirmed) {
                updateId()
            }
            let is_can_screen_recording = await invoke<boolean>("is_can_screen_recording", { prompt: false })
            console.log("is_can_screen_recording: ", is_can_screen_recording)
            if (is_can_screen_recording) {
                // TODO: CanScreenRecording
            }
        }


        const unlisten = listenEvents().catch(() => null)

        return () => {
            unlisten.then((unl) => {    
                console.log(unl)  
            }) 
        }
    }, [keyConfirmed, serviceStopped, systemError, softwareUpdateUrl])
    
    // Inits the app
    useEffect(() => {
        const listenEvents = async () => {
            setServiceStopped(await isServiceStopped())
            setRendezvousServiceStopped(await isRendezvousServiceStopped())
            setUsingPublicServer(await invoke<boolean>("using_public_server"))
            
            let tmp_tuple = await invoke<any>("get_connect_status") 
            setConnectStatus(tmp_tuple[0])
            setKeyConfirmed(tmp_tuple[1])
        }


        const unlisten = listenEvents().catch(() => null)

        return () => {
            unlisten.then((unl) => {    
                console.log(unl)  
            }) 
         }
    }, [])

    // This function calculate X and Y
    const getPosition = () => {
        setDimensions({
            width: refContainer.current.offsetWidth,
            height: refContainer.current.offsetHeight,
        })
    }

    // Get the position of the red box in the beginning
    useEffect(() => {
        getPosition()
    }, [])

    // Re-calculate W and H when the window gets resized by the user
    useEffect(() => {
        window.addEventListener("resize", getPosition)
    }, [])
    
    window.addEventListener("beforeunload", async (ev) => {  
        
        // TODO: get real x, y coords 
        await invoke("closing", {x: 0, y: 0, w: dimensions.width, h: dimensions.height})
        console.log(dimensions.width, dimensions.height)
    })

    const createNewConnect = (id: string, type: string) => {
        const _id = id.replace(/\s/g, "")
        console.log("Id ", _id, " myId ", myId)
        if (!_id) return
        if (_id === myId) {
            console.log("You cannot connect to your own computer")
            // msgbox("custom-error", "Error", "You cannot connect to your own computer")
            return
        }
    
        invoke('set_remote_id', { id: _id }).then()
        invoke('new_remote', { id: _id, remoteType: type }).then()
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
