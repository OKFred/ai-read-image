import OpenAI from "openai";
import * as dotEnv from "dotenv";
dotEnv.config();

const openai = new OpenAI({
    // 若没有配置环境变量，请用百炼API Key将下行替换为：apiKey: "sk-xxx",
    apiKey: process.env.OPENAI_KEY,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

async function main() {
    console.log("开始处理图片...");
    let imagePath = "";
    if (process.env.IMAGE_URL) {
        console.log("使用网络图片:", process.env.IMAGE_URL);
        const res = await fetch(process.env.IMAGE_URL);
        console.log({ status: res.status });
        const arrayBuffer = await res.arrayBuffer();
        const type = res.headers.get("content-type") || "image/png";
        console.log("图片类型:", type);
        const fileContent = Buffer.from(arrayBuffer);
        imagePath = `data:${type};base64,${fileContent.toString("base64")}`;
    } else {
        imagePath = process.env.IMAGE_PATH || "";
        console.log("使用本地图片:", process.env.IMAGE_PATH);
    }
    const model = "qwen2.5-vl-72b-instruct"; // 可按需更换。模型列表：https://help.aliyun.com/zh/model-studio/getting-started/models
    const response = await openai.chat.completions.create({
        model,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: imagePath, // 使用在线图片或本地图片的 Base64 编码
                        },
                    },
                    {
                        type: "text",
                        text: "提取里面的信息，不需要任何空格，区分大小写，仅包含字母或数字，以json格式返回。{result: string}",
                    },
                ],
            },
        ],
    });

    // 提取响应中的内容
    const content = response.choices[0].message.content;
    console.log("输入token数:", response.usage.prompt_tokens);
    console.log("输出token数:", response.usage.completion_tokens);
    //（每千Token）
    //输入成本 0.016元
    //输出成本 0.048元
    const costObj = {
        "qwen2.5-vl-72b-instruct": { input: 0.016, output: 0.048 },
        "qwen2.5-vl-32b-instruct": { input: 0.008, output: 0.024 },
    };
    console.log(
        "费用: 约",
        (
            (response.usage.prompt_tokens * costObj[model].input +
                response.usage.completion_tokens * costObj[model].output) /
            1000
        ).toFixed(6),
        "元",
    );

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

    console.log("✅提取的结果:", result);
    return result;
}

main();
