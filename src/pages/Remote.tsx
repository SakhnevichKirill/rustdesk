import { useEffect, useState } from 'react'

import { Box, Center, CircularProgress, Text } from '@chakra-ui/react'

import { invoke } from '@tauri-apps/api'
import { listen } from '@tauri-apps/api/event'

const Remote = () => {
    const [connectionLoading, setConnecitonLoading] = useState(true)
    const [msg, setMsg] = useState("")

    const [remoteDim, setRemoteDim] = useState({ width: 0, height: 0 })
    const [pixels, setPixels] = useState<Uint8ClampedArray>(new Uint8ClampedArray([0]))

    useEffect(() => {
        const listenEvents = async () => {
            setConnecitonLoading(true)
            await invoke('reconnect')

            const unlistenMsgboxRetry = await listen('msgbox_retry', (e: {
                payload: [
                    // FIXME Im not sure about this fields names
                    status: string, statusMsg: string, connectionMsg: string, idkMsg: string, idkBool: boolean
                ]
                }) => {
                    console.log(e)
                    const status = e.payload[0]
                    if (status === 'success') {
                        setConnecitonLoading(false)
                        setMsg("")
                    }
                    if (status === 'input-password') setMsg('Подтвердите подключение')
                })
            const unlistenSetDisplay = await listen('setDisplay', (e: { payload: [x: number, y: number, w: number, h: number] }) => {
                    setRemoteDim({ width: e.payload[2], height: e.payload[3] })
                })
            const unlistenNativeRemote = await listen('native-remote', (e: { payload: Uint8ClampedArray }) => {
                    setPixels(new Uint8ClampedArray(e.payload))
                })
            return {unlistenSetDisplay, unlistenNativeRemote, unlistenMsgboxRetry}
        }

        const unlisten = listenEvents().catch(() => null)

        return () => {
           unlisten.then(unl => {
              if (unl) {
                  unl.unlistenNativeRemote()
                  unl.unlistenSetDisplay()
                  unl.unlistenMsgboxRetry()
              } 
           }) 
        }
    }, [])

    useEffect(() => {
        const { width, height} = remoteDim
        if (width && height && pixels.length > 1) {
            const imageData = new ImageData(pixels, width, height, {
                colorSpace: "srgb" 
            })
            const canvas = document.getElementById('canvas') as HTMLCanvasElement
            const ctx = canvas?.getContext('2d');
            if (ctx) {
                ctx.putImageData(imageData, 0, 0)
            }
        }
    }, [remoteDim, pixels])
    
    return (
        <Center h="100vh">
            <Box>
                {connectionLoading ?
                    <>"Подключаемся..."<CircularProgress isIndeterminate/></> :
                    <canvas id="canvas" {...remoteDim}></canvas>
                }
                <Text>{msg}</Text>
            </Box>
        </Center>
    )
}

export default Remote
