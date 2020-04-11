import express from "express"
import bodyParser from "body-parser"
import WebSocket from "ws"
import webpush from "web-push"
import fs from "fs"

const app = express()
const REST_URL = "https://beta.innowin.ir/api"
// const REST_URL = "https://innowin.ir/api"
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

fs.readFile("./notif.json", null, (err, data) =>
{
    if (err) console.log(err)
    else arr = JSON.parse(data.toString())
})

wss.on("connection", (ws, req) =>
{
    const parseDetail = req.url.split("/?id=")[1].split("&unique=")
    const userId = parseDetail[0]
    const unique = parseDetail[1]
    if (userId && unique)
    {
        const previous = arr[userId] ? {...arr[userId]} : {}
        arr[userId] = {...previous, status: "ONLINE", [unique]: {ws}}

        try
        {
            fs.writeFile("./notif.json", JSON.stringify(arr), (err) => err ? console.log(err) : console.log("done"))
        }
        catch (e)
        {
            console.log(e.message)
        }

        ws.on("message", (data) =>
        {
            try
            {
                const parsedData = JSON.parse(data)
                if (parsedData.kind === "ping")
                {
                    arr[userId].status = "ONLINE"
                    ws.send(JSON.stringify({message: new Date().toISOString(), kind: "ping"}))
                    fs.writeFile("./notif.json", JSON.stringify(arr), (err) => err ? console.log(err) : console.log("done"))
                }
                else if (parsedData.kind === "seen")
                {
                    const {receiver, roomId} = parsedData
                    if (receiver && arr[receiver])
                    {
                        const receiverArr = Object.values(arr[receiver])
                        for (let i = 0; i < receiverArr.length; i++)
                        {
                            if (receiverArr[i].ws) receiverArr[i].ws.send(JSON.stringify({roomId, kind: "seen"}))
                        }
                    }
                }
            }
            catch (e)
            {
                console.log(e.message)
                ws.send(JSON.stringify({message: new Date().toISOString(), kind: "ping"}))
            }
        })
        ws.on("close", () =>
        {
            if (arr[userId][unique] && arr[userId][unique].token) delete arr[userId][unique].ws
            else delete arr[userId][unique]
            arr[userId].status = new Date().toISOString()
            try
            {
                fs.writeFile("./notif.json", JSON.stringify(arr), (err) => err ? console.log(err) : console.log("done"))
            }
            catch (e)
            {
                console.log(e.message)
            }
        })
    }
})

app.route("/sendMessage")
    .post((req, res) =>
    {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const {socket_id} = req.body
        const data = req.body.data ? {...JSON.parse(req.body.data), kind: "chat"} : {...req.body, kind: "chat"}
        const {receiver, sender} = data
        if (receiver && arr[receiver])
        {
            const receiverArr = Object.values(arr[receiver])
            let tokens = {}
            let sended = false
            for (let i = 0; i < receiverArr.length; i++)
            {
                if (receiverArr[i].ws)
                {
                    sended = true
                    receiverArr[i].ws.send(JSON.stringify(data))
                }
                else if (i === receiverArr.length - 1 && !sended)
                {
                    receiverArr.forEach(socket =>
                    {
                        if (socket.token && tokens[socket.token.keys.auth] !== true)
                        {
                            tokens[socket.token.keys.auth] = true
                            webpush.sendNotification(
                                socket.token,
                                JSON.stringify({
                                    title: data.sender_fullname || "پیام رسان اینوین",
                                    icon: data.sender_profile_media && data.sender_profile_media.file ?
                                        data.sender_profile_media.file.includes(REST_URL) ? data.sender_profile_media.file : REST_URL + data.sender_profile_media.file
                                        :
                                        "https://innowin.ir/icon-192x192.png",
                                    body: data.attachment && data.attachment.file && data.attachment.type === "image" ? "" : data.text,
                                    image: data.attachment && data.attachment.file && data.attachment.type === "image" ?
                                        data.attachment.file.includes(REST_URL) ? data.attachment.file : REST_URL + data.attachment.file
                                        :
                                        null,
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
    .post((req, res) =>
    {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const data = {...req.body, kind: "notification"}
        const {id} = data
        if (id && arr[id])
        {
            Object.values(arr[id]).forEach(socket => socket.ws && socket.ws.send(JSON.stringify(data)))
            res.send({state: 1, message: "notif sent to the user"})
        }
        else res.send({state: -1, message: "user is not online & wasn't"})
    })

app.route("/sendPost")
    .post((req, res) =>
    {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const data = {...req.body, kind: "post"}
        Object.values(arr).forEach(user => Object.values(user).forEach(socket => socket.ws && socket.ws.send(JSON.stringify(data))))
        res.send({state: 1, message: "post sent to all users"})
    })

app.route("/getLastSeen")
    .get((req, res) =>
    {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const userId = req.query && req.query.userId
        if (userId && arr[userId]) res.send({status: arr[userId].status})
        else res.send({status: null})
    })

app.route("/riyasat")
    .get((req, res) => res.send(arr))

app.route("*")
    .get((req, res) => res.send("Hello Babes!"))

app.route("/subscribe")
    .post((req, res) =>
    {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const {subscription, userId, unique} = req.body
        if (arr[userId] && arr[userId][unique]) arr[userId][unique].token = subscription
        res.sendStatus(200)
    })