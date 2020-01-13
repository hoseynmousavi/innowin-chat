import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import WebSocket from "ws"
import webpush from "web-push"

const app = express()
const REST_URL = "https://betaback.innowin.ir"
// const REST_URL = "https://back.innowin.ir"
app.use(cors())
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

webpush.setGCMAPIKey("AIzaSyCs3A46ckvbZwZCgFVBkWys_woOoSMFMbI")
webpush.setVapidDetails(
    "mailto:hoseyn.mousavi78@gmail.com",
    "BPAnD6orqwKDMUaBB-pHlnh3FwgcEBzrJPdGarY-oyOaHglrxPGSaYETOMn-dfvvIL0HgN6HDUqVi016081bP5k",
    "Z4reUR3PPwJDIRYxUVMNeNzRBrgW5jl9bKruQSOxqdg",
)

const wss = new WebSocket.Server({server: app.listen(5000)})

let arr = {}

wss.on("connection", (ws, req) => {
    const parseDetail = req.url.split("/?id=")[1].split("&unique=")
    const userId = parseDetail[0]
    const unique = parseDetail[1]
    if (userId && unique) {
        const previous = arr[userId] ? {...arr[userId]} : {}
        arr[userId] = {...previous, status: "ONLINE", [unique]: {ws}}
        ws.on("message", (data) => {
            try {
                const parsedData = JSON.parse(data)
                if (parsedData.kind === "ping") {
                    arr[userId].status = "ONLINE"
                    ws.send(JSON.stringify({message: new Date().toISOString(), kind: "ping"}))
                }
                else if (parsedData.kind === "seen") {
                    const {receiver, roomId} = parsedData
                    if (receiver && arr[receiver]) {
                        const receiverArr = Object.values(arr[receiver])
                        for (let i = 0; i < receiverArr.length; i++) {
                            if (receiverArr[i].ws) receiverArr[i].ws.send(JSON.stringify({roomId, kind: "seen"}))
                        }
                    }
                }
            }
            catch (e) {
                console.log("problem in parse")
                ws.send(JSON.stringify({message: new Date().toISOString(), kind: "ping"}))
            }
        })
        ws.on("close", () => {
            if (arr[userId][unique] && arr[userId][unique].token) arr[userId][unique].ws = null
            else delete arr[userId][unique]
            arr[userId].status = new Date().toISOString()
        })
    }
})

app.route("/sendMessage")
    .post((req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const {socket_id} = req.body
        const data = req.body.data ? {...JSON.parse(req.body.data), kind: "chat"} : {...req.body, kind: "chat"}
        const {receiver, sender} = data
        if (receiver && arr[receiver]) {
            const receiverArr = Object.values(arr[receiver])
            let tokens = {}
            let sended = false
            for (let i = 0; i < receiverArr.length; i++) {
                if (receiverArr[i].ws) {
                    sended = true
                    receiverArr[i].ws.send(JSON.stringify(data))
                }
                else if (i === receiverArr.length - 1 && !sended) {
                    receiverArr.forEach(socket => {
                        if (socket.token && tokens[socket.token.keys.auth] !== true) {
                            tokens[socket.token.keys.auth] = true
                            webpush.sendNotification(
                                socket.token,
                                JSON.stringify({
                                    title: data.sender_fullname || "پیام رسان اینوین",
                                    body: data.text,
                                    icon: data.sender_profile_media && data.sender_profile_media.file ?
                                        data.sender_profile_media.file.includes(REST_URL) ? data.sender_profile_media.file : REST_URL + data.sender_profile_media.file
                                        :
                                        "https://innowin.ir/icon-192x192.png",
                                    tag: sender.toString(),
                                    requireInteraction: true,
                                    renotify: true,
                                }),
                            )
                                .catch(err => console.error(err))
                        }
                    })
                }
            }
            res.send({state: 1, message: "message sent to the user"})
        }
        else res.send({state: -1, message: "user is not online & wasn't"})

        if (sender && arr[sender]) Object.values({...arr[sender], [socket_id]: {ws: null}}).forEach(socket => socket.ws && socket.ws.send(JSON.stringify(data)))
    })

app.route("/sendNotif")
    .post((req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const data = {...req.body, kind: "notification"}
        const {id} = data
        if (id && arr[id]) {
            Object.values(arr[id]).forEach(socket => socket.ws && socket.ws.send(JSON.stringify(data)))
            res.send({state: 1, message: "notif sent to the user"})
        }
        else res.send({state: -1, message: "user is not online & wasn't"})
    })

app.route("/sendPost")
    .post((req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const data = {...req.body, kind: "post"}
        Object.values(arr).forEach(user => Object.values(user).forEach(socket => socket.ws && socket.ws.send(JSON.stringify(data))))
        res.send({state: 1, message: "post sent to all users"})
    })

app.route("/getLastSeen")
    .get((req, res) => {
        const userId = req.query && req.query.userId
        if (userId && arr[userId]) res.send({status: arr[userId].status})
        else res.send({status: null})
    })

app.route("/riyasat")
    .get((req, res) => res.send(arr))

app.route("*")
    .get((req, res) => res.send("Hello Babes!"))

app.route("/subscribe")
    .post((req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const {subscription, userId, unique} = req.body
        if (arr[userId] && arr[userId][unique]) arr[userId][unique].token = subscription
        res.sendStatus(200)
    })