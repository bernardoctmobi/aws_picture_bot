import { RekognitionClient, DetectLabelsCommand } from "@aws-sdk/client-rekognition";
import axios from "axios";
import TelegramBot from "node-telegram-bot-api";
const client = new RekognitionClient({});
const botToken = process.env.botToken;
const bot = new TelegramBot(`${botToken}`, { polling: false });

export const lambdaHandler = async (event) => {
    const body = JSON.parse(event.body);
    const chatId = body.message.chat.id;
    if (body.message && body.message.document) {
        bot.sendMessage(chatId, `Sto analizzando l'immagine, attendi per favore`);
        const document = body.message.document;
        const fileId = document.file_id;

        const response = await getTelegramFile(fileId)
            .then(telegramFile => getLabels(telegramFile))
            .then(labels => sendResponse(labels, chatId))
            .catch(error => {
                console.error('Errore: ', error);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ message: error })
                };
            });
        console.log(response);
        return response;
    } else {
        await bot.sendMessage(chatId, `Non ci sono immagini da analizzare`);
        return {
            statusCode: 200,
            body: 'Non ci sono immagini da analizzare...'
        };
    }
};

async function getTelegramFile(fileId) {
    const apiUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const response = await axios.get(apiUrl);
    if (response.data.ok) {
        const file = response.data.result;
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
        const fileData = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        return Buffer.from(fileData.data).toString('base64');
    }
    throw new Error('Errore nel recupero del file da Telegram');
}

async function getLabels(telegramFile) {
    try {
        const input = {
            Image: {
                Bytes: Buffer.from(telegramFile, 'base64')
            },
            Features: [
                "GENERAL_LABELS"
            ]
        };
        const command = new DetectLabelsCommand(input);
        const response = await client.send(command);
        console.log(response);
        return response.Labels;
    } catch (err) {
        console.log(err);
        throw new Error('Non è stato possibile recuperare le etichette');
    }
}

async function sendResponse(labels, chatId) {
    if (!labels) {
        await bot.sendMessage(chatId, `Etichette mancanti`);
        return {
            statusCode: 500,
            body: `Etichette mancanti`
        };
    };
    const labelsArray = labels.map(label => label.Name);
    await bot.sendMessage(chatId, `Etichette estratte: ${labelsArray.join(', ')}`);
    return {
        statusCode: 200,
        body: JSON.stringify({
            labels: labels,
        })
    };
}
