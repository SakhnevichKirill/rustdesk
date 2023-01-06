import { useEffect, useState, useRef, useMemo } from 'react'

import { Box, Center, CircularProgress, Text } from '@chakra-ui/react'

import { invoke } from '@tauri-apps/api'
import { listen } from '@tauri-apps/api/event'

const Remote = () => {
    const [connectionLoading, setConnecitonLoading] = useState(true)
    const [msg, setMsg] = useState("")
    const [connectionSpeed, setConnectionSpeed] = useState("")

    const videoRef = useRef<HTMLVideoElement | null>(null)
    const mediaSource = useMemo(() => new MediaSource(), [])
    let mediaSrcBuffer: SourceBuffer | null = null

    const [remoteDim, setRemoteDim] = useState({ width: 0, height: 0 })
    const [pixels, setPixels] = useState<Uint8ClampedArray>(new Uint8ClampedArray([0]))

    useEffect(() => {
        const video = videoRef.current
        if ('MediaSource' in window && video) {
            video.src = URL.createObjectURL(mediaSource)
            mediaSource.addEventListener('sourceopen', handleSourceOpen)
            return () => {
                mediaSource.removeEventListener('sourceopen', handleSourceOpen)
            };
        } else
            console.error('Doesnt support MediaSource')
    }, [mediaSource])

    const handleSourceOpen = () => {
       mediaSrcBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp9"')
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    useEffect(() => {
        const listenEvents = async () => {
            setConnecitonLoading(true)
            await invoke('reconnect')
            
            const unlistenRecord = await listen('on_record', async (e: { payload: { data: number[] }[] }) => {
                console.log(e)

                // Init video recording to WebM and encoded_frames emitter
                await invoke('refresh_video') 
                await invoke('record_screen', { start: true, w: remoteDim.width, h: remoteDim.height }) 

                // Wait for 10 seconds
                await sleep(10000)

                // Stop recording and write tail of video
                // TODO: tail of video written wrong
                await invoke('record_screen', { start: false, w: remoteDim.width, h: remoteDim.height })
            })
            invoke('record_screen', { start: false, w: remoteDim.width, h: remoteDim.height })

            // FIXME for every tauri e type I need to e: {payload: {...}}
            // TODO: fix payload to [EncodedVideoFrame]
            const unlistenEncodedFrames = await listen('encoded_frames', (e: { payload: { data: number[] }[] }) => {
                console.log(e)
                // // TODO могут данные прийти, а буфера нет открылось?
                // if (mediaSrcBuffer) {
                //     const binArr = new Uint8Array(e.payload[0].data)
                //     mediaSrcBuffer.appendBuffer(binArr.buffer)
                // }
            })

            const unlistenMsgboxRetry = await listen('msgbox_retry', (e: {
                payload: [
                    // FIXME Im not sure about this fields names
                    status: string, statusMsg: string, connectionMsg: string, idkMsg: string, idkBool: boolean
                ]
            }) => {
                const status = e.payload[0]
                if (status === 'success') {
                    setConnecitonLoading(false)
                    setMsg("")
                }
                if (status === 'input-password') setMsg('Подтвердите подключение')
            })
            const unlistenSetDisplay = await listen('setDisplay', (e: { payload: [x: number, y: number, w: number, h: number] }) => {
                const width = e.payload[2]
                const height = e.payload[3]
                setRemoteDim({ width, height })
            })
            const unlistenNativeRemote = await listen('native-remote', (e: { payload: Uint8ClampedArray }) => {
                setPixels(new Uint8ClampedArray(e.payload))
            })
            const unlistenUpdateQualityStatus = await listen('updateQualityStatus', (e: { payload: string[] }) => {
                setConnectionSpeed(e.payload[0])
            })

            return { unlistenRecord, unlistenSetDisplay, unlistenNativeRemote, unlistenMsgboxRetry, unlistenUpdateQualityStatus, unlistenEncodedFrames }
        }

        const unlisten = listenEvents().catch(() => null)

        return () => {
            // FIXME It's awkward write every func, better to use array
            unlisten.then(unl => {
                if (unl) {
                    unl.unlistenRecord()
                    unl.unlistenNativeRemote()
                    unl.unlistenSetDisplay()
                    unl.unlistenMsgboxRetry()
                    unl.unlistenUpdateQualityStatus()
                    unl.unlistenEncodedFrames()
                }
            })
        }
    }, [])

    useEffect(() => {
        const { width, height } = remoteDim
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
            <Text pos='absolute' left={0} top={0} color='red'>{connectionSpeed}</Text>
            <Box height='100%'>
                {connectionLoading ?
                    <>"Подключаемся... "<CircularProgress isIndeterminate /></> :
                    <canvas id="canvas" width={1690} height={1122}></canvas>
                }
                <Text>{msg}</Text>
            </Box>
            <video ref={videoRef}/>
        </Center>
    )
}

export default Remote
