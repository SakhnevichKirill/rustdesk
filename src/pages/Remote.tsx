import { useEffect, useState } from 'react'

import { Box, Center, CircularProgress, Text } from '@chakra-ui/react'

import { invoke } from '@tauri-apps/api'
import { listen } from '@tauri-apps/api/event'
import { appWindow } from '@tauri-apps/api/window'

class EncodedFrame {
    data: Uint8Array //Uint8ClampedArray 
    key: boolean
    pts: number
    constructor(
        data: Uint8Array,
        key: boolean,
        pts: number,
    ) {
        this.data = data
        this.key = key
        this.pts = pts
    }
}


const Remote = () => {
    const [connectionLoading, setConnecitonLoading] = useState(true)
    const [msg, setMsg] = useState("")
    const [connectionSpeed, setConnectionSpeed] = useState("")

    const [remoteDim, setRemoteDim] = useState({ width: 0, height: 0 })
    const [pixels, setPixels] = useState<Uint8ClampedArray>(new Uint8ClampedArray([0]))
    const [reconnectTimeout, setReconnectTimeout] = useState(1000) 
    const [initMuxer, setInitMuxer] = useState<boolean>(false)

    useEffect(() => {
        const listenEvents = async () => {
            setConnecitonLoading(true)

            // TODO: emit on "video#handler" init
            appWindow.emit('native-remote')

            const unlistenNativeRemoteResponse = await listen('native-remote-response', (e: { payload: any }) => {
                retryConnect()
            })

            const connecting = () => {
                // TODO: implement msgbox
                // handler.msgbox("connecting", "Connecting...", "Connection in progress. Please wait.")
            }

            const retryConnect = (cancelTimer: boolean = false) => {
                invoke<boolean>("is_port_forward").then((is_port_forward) => {
                    if (cancelTimer) setTimeout(retryConnect, 0)
                    if (!is_port_forward) connecting()
                    invoke("reconnect").then()
                    console.log("reconnect")
                })
            }

            const unlistenMsgboxRetry = await listen('msgbox_retry', (e: {
                payload: [
                    type: string, title: string, text: string, link: string, hasRetry: boolean
                ]
            }) => {
                const type = e.payload[0]
                // const title = e.payload[1]
                // const text = e.payload[2]
                // const link = e.payload[3]
                const hasRetry = e.payload[4]
                
                
                if (type) {
                    setConnecitonLoading(false)
                    setMsg("")
                }
                if (type === 'input-password') setMsg('Подтвердите подключение')

                // TODO: implement msgbox
                // handler.msgbox(type, title, text, link, hasRetry)
                if (hasRetry) {
                    setTimeout(retryConnect, 0)
                    setTimeout(retryConnect, reconnectTimeout)
                    setReconnectTimeout(reconnectTimeout * 2)
                } else {
                    setReconnectTimeout(1000)
                }
            })
            const unlistenSetDisplay = await listen('setDisplay', (e: { payload: [x: number, y: number, w: number, h: number] }) => {
                setRemoteDim({ width: e.payload[2], height: e.payload[3] })
            })
            const unlistenRenderFrame = await listen('render_frame', (e: { payload: Uint8ClampedArray }) => {
                setPixels(new Uint8ClampedArray(e.payload))
            })
            const unlistenUpdateQualityStatus = await listen('updateQualityStatus', (e: {payload: string[]}) => {
                setConnectionSpeed(e.payload[0])
            })

            return {unlistenNativeRemoteResponse, unlistenMsgboxRetry, unlistenSetDisplay, unlistenRenderFrame, unlistenUpdateQualityStatus}
        }

        const unlisten = listenEvents().catch(() => null)

        return () => {
           unlisten.then(unl => {
              if (unl) {
                unl.unlistenNativeRemoteResponse()
                unl.unlistenMsgboxRetry()
                unl.unlistenSetDisplay()
                unl.unlistenRenderFrame()
                unl.unlistenUpdateQualityStatus()
              } 
           }) 
        }
    }, [])

    useEffect(() => {
        const listenEvents = async () => {
            const unlistenEncodedFrames = await listen('encoded_frames', (e: { payload: EncodedFrame }) => {

                // tmp_muxer.addVideoChunkRaw(
                //     e.payload.data,
                //     e.payload.key == true ? 'key' : 'delta',
                //     e.payload.pts,
                //     {decoderConfig: {codec: 'vp9' }}
                // )

                
                // setPixels(new Uint8ClampedArray(e.payload))
            })
            return {unlistenEncodedFrames}
        }

        const unlisten = listenEvents().catch(() => null)

        return () => {
           unlisten.then(unl => {
              if (unl) {
                unl.unlistenEncodedFrames()
              } 
           }) 
        }
    }, [initMuxer])

    useEffect(() => {
        console.log("remoteDim", remoteDim)
        // TODO:
        // Create a muxer with a video track running the VP9 codec, and no
        // audio track. The muxed file is written to a buffer in memory.

        // const { width, height} = remoteDim
        // if (width && height && pixels.length > 1) {
        //     const imageData = new ImageData(pixels, width, height, {
        //         colorSpace: "srgb" 
        //     })
        //     const canvas = document.getElementById('canvas') as HTMLCanvasElement
        //     const ctx = canvas?.getContext('2d')
        //     if (ctx) {
        //         ctx.putImageData(imageData, 0, 0)
        //     }
        // }
    }, [remoteDim, pixels])
    
    return (
        <Center h="100vh">
            <Text pos='absolute' left={0} top={0} color='red'>{connectionSpeed}</Text>
            <Box height='100%'>
                {connectionLoading ?
                    <>"Подключаемся... "<CircularProgress isIndeterminate/></> :
                    <canvas id="canvas" width={1690} height={1122}></canvas>
                }
                <Text>{msg}</Text>
            </Box>
        </Center>
    )
}

export default Remote
