import { invoke } from '@tauri-apps/api'
import { listen } from '@tauri-apps/api/event'

const Remote = () => {
    invoke('reconnect')
        .then(() => {
            listen('native-remote', (e:any) => {
                console.log(e.payload)
            })
        })

    return (
        <div>
            Remote
        </div>
    )
}

export default Remote
