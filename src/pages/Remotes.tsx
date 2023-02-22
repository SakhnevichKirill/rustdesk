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

const handler_msgbox = (type: string, title: string, text: string, link: string = "", hasRetry=false) => {
    // crash somehow (when input wrong password), even with small time, for example, 1ms
    setTimeout(() => {msgbox(type, title, text, link, null, 180, 500, hasRetry);}, 60);
}

const msgbox = async (type: string, title: string, content: string, link: string="", callback: any=null, height=180, width=500, hasRetry=false, contentStyle="") => {
    // $(body).scrollTo(0, 0);
    if (!type) {
        // closeMsgbox();
        return;
    }
    let remember = false;
    try { remember = await invoke("get_remember"); } catch(e) {}
    let auto_login = false;
    try { auto_login = await invoke("get_option", {key: "auto-login"}) != ''; } catch(e) {}
    // width += is_xfce ? 50 : 0;
    // height += is_xfce ? 50 : 0;

    if (type.indexOf("input-password") >= 0) {
        callback = function (res: { password: any; remember: any }) {
            if (!res) {
                // view.close();
                return;
            }
            invoke("login", {password: res.password, remember: res.remember}).then(); 
            // if (!is_port_forward) {
            //   // Specially handling file transfer for no permission hanging issue (including 60ms
            //   // timer in setPermission.
            //   // For wrong password input hanging issue, we can not use handler.msgbox.
            //   // But how about wrong password for file transfer?
            //   if (is_file_transfer) handler_msgbox("connecting", "Connecting...", "Logging in...");
            //   else msgbox("connecting", "Connecting...", "Logging in...");
            // }
        };
    // } else if (type.indexOf("custom") < 0 && !is_port_forward && !callback) {
        // callback = function() { view.close(); }
    } else if (type == 'wait-remote-accept-nook') {
        callback = function (res: any) {
            if (!res) {
                // view.close();
                return;
            }
        };
    }
    let last_msgbox_tag = type + "-" + title + "-" + content + "-" + link;
    // $(#msgbox).content(<MsgboxComponent width={width} height={height} auto_login={auto_login} type={type} title={title} content={content} link={link} remember={remember} callback={callback} contentStyle={contentStyle} hasRetry={hasRetry} />);
}

const contextMenu = async () => {
    let configOptions: any = await invoke("get_options");
    let old_relay = configOptions["relay-server"] || "";
    let old_api = configOptions["api-server"] || "";
    let old_id = configOptions["custom-rendezvous-server"] || "";
    let old_key = configOptions["key"] || "";
    msgbox("custom-server", "ID/Relay Server", "<div .form .set-password> \
    <div><span>" + "ID Server" + ": </span><input|text .outline-focus name='id' value='" + old_id + "' /></div> \
    <div><span>" + "Relay Server" + ": </span><input|text name='relay' value='" + old_relay + "' /></div> \
    <div><span>" + "API Server" + ": </span><input|text name='api' value='" + old_api + "' /></div> \
    <div><span>" + "Key" + ": </span><input|text name='key' value='" + old_key + "' /></div> \
    </div> \
    ", "", async (res: any=null) => {
        if (!res) return;
        let id = (res.id || "").trim();
        let relay = (res.relay || "").trim();
        let api = (res.api || "").trim().toLowerCase();
        let key = (res.key || "").trim();
        if (id == old_id && relay == old_relay && key == old_key && api == old_api) return;
        if (id) {
            let err = await invoke("test_if_valid_server", {host: id});
            if (err) return "ID Server" + ": " + err;
        }
        if (relay) {
            let err = await invoke("test_if_valid_server", {host: relay});
            if (err) return "Relay Server" + ": " + err;
        }
        if (api) {
            if (0 != api.indexOf("https://") && 0 != api.indexOf("http://")) {
                return  "API Server" + ": " + "invalid_http";
            }
        }
        configOptions["custom-rendezvous-server"] = id;
        configOptions["relay-server"] = relay;
        configOptions["api-server"] = api;
        configOptions["key"] = key;
        await invoke("set_options", {m: configOptions});
    }, 260);
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
            } else {
                console.log("Generating ...")
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
            // TODO: implement a menu to configure the server
            // TODO: implement msgbox popup
            // contextMenu().then()

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

    // TODO: show connection status
    const getConnectStatusStr = async () => {
        if (serviceStopped) {
            return "Service is not running";
        } else if (connectStatus === -1) {
            return 'not_ready_status';
        } else if (connectStatus === 0) {
            return 'connecting_status';
        }
        if (!await invoke("using_public_server")) return 'Ready';
        return <span>{"Ready"}, <span>{"setup_server_tip"}</span></span>;
    }

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
