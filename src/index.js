import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import WebSocket from "ws"
import webpush from "web-push"
import fs from "fs"

const app = express()
const REST_URL = "https://beta.innowin.ir/api"
// const REST_URL = "https://innowin.ir/api"

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
let fileArr = {}

fs.readFile("./notif.json", null, (err, data) =>
{
    if (err) console.log(err)
    else
    {
        arr = JSON.parse(data.toString())
        fileArr = JSON.parse(data.toString())
    }
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

        const previousFile = fileArr[userId] ? {...fileArr[userId]} : {}
        fileArr[userId] = {...previousFile, status: "ONLINE", [unique]: {}}

        try
        {
            fs.writeFile("./notif.json", JSON.stringify(fileArr), (err) => err ? console.log("save err") : console.log("done"))
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
                    ws.send(JSON.stringify({message: new Date().toISOString(), kind: "ping"}))
                    arr[userId].status = "ONLINE"
                    fileArr[userId].status = "ONLINE"
                    fs.writeFile("./notif.json", JSON.stringify(fileArr), (err) => err ? console.log("save err") : console.log("done"))
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
            if (arr[userId][unique] && arr[userId][unique].token)
            {
                delete arr[userId][unique].ws
                delete fileArr[userId][unique].ws
            }
            else
            {
                delete arr[userId][unique]
                delete fileArr[userId][unique]
            }
            arr[userId].status = new Date().toISOString()
            fileArr[userId].status = new Date().toISOString()

            try
            {
                fs.writeFile("./notif.json", JSON.stringify(fileArr), (err) => err ? console.log("save err") : console.log("done"))
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
                                    url: `/chat/${sender}`,
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

app.route("/sendNotifToUser")
    .post((req, res) =>
    {
        res.setHeader("Access-Control-Allow-Origin", "*")
        const {receiver, title, icon, body, url} = req.body
        if (receiver && title && body)
        {
            const receiverArr = Object.values(arr[receiver])
            let tokens = {}
            for (let i = 0; i < receiverArr.length; i++)
            {
                receiverArr.forEach(socket =>
                {
                    if (socket.token && tokens[socket.token.keys.auth] !== true)
                    {
                        tokens[socket.token.keys.auth] = true
                        webpush.sendNotification(
                            socket.token,
                            JSON.stringify({
                                title,
                                icon: icon || "https://innowin.ir/icon-192x192.png",
                                body,
                                tag: title,
                                url: url || "https://innowin.ir/home",
                                requireInteraction: true,
                                renotify: true,
                            }),
                        )
                            .catch(err => console.error(err))
                    }
                })
            }
            res.send({state: 1, message: "message sent to the user"})
        }
        else res.status(400).send({state: -1, message: "send receiver, title, body"})
    })

app.route("/broadcast")
    .post((req, res) =>
    {
        const {title, icon, body, image, tag, url, requireInteraction} = req.body
        if (title && body && tag && url)
        {
            res.status(200).send({message: "I will try my best Mr.Sajad"})

            Object.values(arr).forEach(item =>
            {
                Object.values(item).forEach(notif =>
                {
                    webpush.sendNotification(
                        notif.token,
                        JSON.stringify({
                            title,
                            icon: icon ? icon : "https://innowin.ir/icon-192x192.png",
                            body,
                            image: image ? image : null,
                            tag,
                            url,
                            requireInteraction,
                            renotify: true,
                        }),
                    )
                        .catch(err => console.error(err))
                })
            })
        }
        else res.status(400).send({message: "send title && body && tag && url"})
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
        if (arr[userId] && arr[userId][unique])
        {
            arr[userId][unique].token = subscription
            fileArr[userId][unique].token = subscription

            try
            {
                fs.writeFile("./notif.json", JSON.stringify(fileArr), (err) => err ? console.log("save err") : console.log("done"))
            }
            catch (e)
            {
                console.log(e.message)
            }
        }
        res.sendStatus(200)
    })