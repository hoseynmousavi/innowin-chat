import express from "express"
import bodyParser from "body-parser"
import WebSocket from "ws"

const app = express()
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())


const wss = new WebSocket.Server({port: 8080})

let arr = {}

wss.on("connection", (ws, req) =>
{
    const userId = req.url.split("/?id=")[1]
    arr[userId] = ws

    ws.on("message", (data) =>
    {
        const parsedData = JSON.parse(data)
        arr[parsedData.receiverId] && arr[parsedData.receiverId].send(JSON.stringify(parsedData))
    })

    ws.on("close", () =>
    {
        delete arr[userId]
    })
})

app.listen(5000, () => console.log(`Innowin Chat is Now Running on Port 5000`))
