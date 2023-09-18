import { RekognitionClient, DetectLabelsCommand } from "@aws-sdk/client-rekognition";
import axios from "axios";
import TelegramBot from "node-telegram-bot-api";
const client = new RekognitionClient({});
const botToken = process.env.botToken;
const bot = new TelegramBot(`${botToken}`, { polling: false });

export const lambdaHandler = async (event, context) => {
    const body = JSON.parse(event.body);
    if (body.message && body.message.document) {
        const document = body.message.document;
        const fileId = document.file_id;
        const telegramFile = await getTelegramFile(fileId);
        const chatId = body.message.chat.id;
        bot.sendMessage(chatId, `Sto analizzando l'immagine, attendi per favore`);
        const input = {
            Image: {
                Bytes: Buffer.from(telegramFile, 'base64')
            },
            Features: [
                "GENERAL_LABELS"
            ]
        };
        const command = new DetectLabelsCommand(input);
        try {
            const response = await client.send(command);
            console.log(response);
            const labelsArray = response.Labels.map(label => label.Name);
            console.log(`Etichette estratte: ${labelsArray.join(', ')}`);
            await bot.sendMessage(chatId, `Etichette estratte: ${labelsArray.join(', ')}`);
            return {
                'statusCode': 200,
                'body': JSON.stringify({
                    Labels: response.Labels,
                })
            }
        } catch (err) {
            console.log(err);
            return err;
        }
    } else {
        return {
            statusCode: 200,
            body: JSON.stringify('Messaggio ricevuto ma non contiene un documento.')
        }
    }
};

async function getTelegramFile(fileId) {
    const apiUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const response = await axios.get(apiUrl);
    console.log(response);
    if (response.data.ok) {
        const file = response.data.result;
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
        const fileData = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        return Buffer.from(fileData.data).toString('base64');
    }
    throw new Error('Errore nel recupero del file da Telegram');
}
