import OpenAI from "openai";
import * as dotEnv from "dotenv";
import fs from "fs";
dotEnv.config();

const openai = new OpenAI({
    // 若没有配置环境变量，请用百炼API Key将下行替换为：apiKey: "sk-xxx",
    apiKey: process.env.OPENAI_KEY,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

function localImageToBase64(filePath: string): string {
    if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
    }
    const fileContent = fs.readFileSync(filePath);
    const fileExtension = filePath.split(".").pop()?.toLowerCase();
    let type = "image/jpeg"; // 默认类型为 JPEG
    if (fileExtension === "png") {
        type = "image/png";
    } else if (fileExtension === "jpg" || fileExtension === "jpeg") {
        type = "image/jpeg";
    }
    return `data:${type};base64,${fileContent.toString("base64")}`;
}

async function main() {
    const useOnlineImage = process.env.IMAGE_URL ? true : false; // 检查是否使用在线图片
    let imagePathToUse = useOnlineImage
        ? process.env.IMAGE_URL
        : localImageToBase64(process.env.IMAGE_PATH); // 如果使用在线图片，则使用环境变量中的 URL，否则使用本地图片路径
    const response = await openai.chat.completions.create({
        model: "qwen2.5-vl-32b-instruct", // 可按需更换。模型列表：https://help.aliyun.com/zh/model-studio/getting-started/models
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: imagePathToUse, // 使用在线图片或本地图片的 Base64 编码
                        },
                    },
                    {
                        type: "text",
                        text: "提取里面的信息，不需要任何空格，区分大小写，以json格式返回。{result: string}",
                    },
                ],
            },
        ],
    });

    // 提取响应中的内容
    const content = response.choices[0].message.content;

    // 从内容中提取 JSON（去除 markdown 代码块标记）
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    let result;

    if (jsonMatch) {
        // 如果找到了 JSON 代码块，解析其中的 JSON
        result = JSON.parse(jsonMatch[1]);
    } else {
        // 如果没有代码块标记，尝试直接解析整个内容
        try {
            result = JSON.parse(content);
        } catch (error) {
            console.error("无法解析 JSON:", error);
            result = { result: content }; // 如果解析失败，将原内容作为结果
        }
    }

    console.log("提取的结果:", result);
    return result;
}

main();
