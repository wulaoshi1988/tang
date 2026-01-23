/**
 * 《大唐古诗穿越记》核心逻辑文件
 * 基于《桃源记》架构，适配唐诗题材
 * 
 * 核心变化：
 * - 角色系统：村民 -> 长安文人
 * - 资源系统：口粮/薪柴 -> 诗稿/墨宝/美酒
 * - 主要玩法：种田/采集 -> 游历/诗会/科举
 * - 核心AI功能：生活事件生成 -> 诗词创作/诗会/科举
 */

// ==================== 全局配置 ====================

const STORAGE_CONFIG = {
    MAX_CHRONICLES: 500,
    MAX_POETRY_COLLECTION: 200,        // 最大诗稿数量
    MAX_AI_HISTORY: 50,
    COMPRESS_THRESHOLD: 3 * 1024 * 1024,
    WARNING_THRESHOLD: 4 * 1024 * 1024,
    CRITICAL_THRESHOLD: 4.5 * 1024 * 1024
};

const POETRY_TYPES = {
    '五言绝句': { chars: 5, lines: 4, rhymeLines: [1, 3] },
    '七言绝句': { chars: 7, lines: 4, rhymeLines: [1, 3] },
    '五言律诗': { chars: 5, lines: 8, rhymeLines: [1, 3, 5, 7], parallelLines: [2, 3, 4, 5] },
    '七言律诗': { chars: 7, lines: 8, rhymeLines: [1, 3, 5, 7], parallelLines: [2, 3, 4, 5] }
};

// ==================== 游戏默认数据 ====================

function createDefaultGameData() {
    return {
        // API 配置（已预设）
        settings: {
            apiBaseUrl: 'https://api.code-relay.com/v1',
            apiKey: 'sk-9mETcZgCAi1oaR1SI9IarN5H862gOW7Bg46MwB0F5adtQtaV',
            model: 'gemini-3-pro-preview',  // 默认模型
            availableModels: ['gemini-3-pro-preview', 'gpt-3.5-turbo', 'gpt-4'],  // 可用模型列表
            lastModelFetch: null,  // 上次获取模型的时间
            connectionStatus: 'unknown'  // 连接状态: unknown, testing, success, failed
        },
        
        // 世界设定
        world: {
            dynasty: '大唐',              // 固定为唐朝
            emperorName: '李隆基',        // 玄宗
            yearTitle: '天宝',            // 年号（可变化）
            year: 1,
            month: 3,
            weather: '晴',
            season: '春',
            townName: '长安',
            countyName: '京兆',
            townDescription: '万国来朝之地，诗乐风流之乡。',
            specialProduct: '荔枝',
            currentLocation: '长安城',
            isPoetryPartyMonth: false,    // 本月是否有诗会
            isExamMonth: false             // 本月是否有科举
        },
        
        // 主角数据
        protagonist: {
            id: 'protagonist',
            name: '',
            gender: '女',
            age: 18,
            identity: '游学才女',
            courtesyName: '',              // 表字
            avatar: '',
            stats: {
                literaryTalent: 30,        // 文采（0-100）
                charm: 40,                 // 魅力
                health: 100,               // 健康
                reputation: 0              // 声望（-100到100）
            },
            status: '健康',
            mood: '平静',
            money: 1000,                    // 铜钱
            house: '草堂',                  // 居所类型
            backpack: [],                  // 背包
            relations: {},                 // 关系网
            career: '无',                  // 职业/功名
            careerLevel: 0,                // 官职等级（0-9）
            examHistory: [],               // 考试历史
            poetryCount: 0                 // 创作诗稿数量
        },
        
        // 弟弟数据（可选）
        brother: null,
        
        // 数据集合
        characters: [],                    // 所有文人
        chronicles: [],                    // 记事记录
        aiHistory: [],                     // AI生成历史
        poetryCollection: [],              // 诗稿收藏
        poetryPartyRecords: [],            // 诗会记录
        examRecords: [],                   // 科举记录
        pendingPoets: [],                  // 待添加的AI文人
        customSceneSettings: {},           // 自定义场景设置
        gameStarted: false
    };
}

let gameData = createDefaultGameData();
let blobUrlCache = new Map();

// ==================== Prompt 定义 ====================

/**
 * Prompt 1：长安文人系统生成
 */
const poetSystemPrompt = `你是唐代长安城的文人档案管理员，精通唐诗格律与历史典故。

【核心原则】
1. 生成的人物必须符合唐代社会阶层（皇室、官宦、名士、隐逸、商贾、市井）
2. 诗词创作需严格符合格律（平仄、押韵、对仗）
3. 人物性格需与诗风统一（如：豪放不羁者写边塞诗，婉约细腻者写闺怨诗）
4. 避免使用真实唐代名人姓名，但可模仿其风格
5. 所有数值必须是整数，文本字段不能为空`;

function generatePoetsPrompt(count = 6) {
    return `请为《大唐古诗穿越记》生成 ${count} 位长安城的文人角色。

【世界背景】
- 时间：架空唐朝盛世（类似开元、天宝年间）
- 地点：长安城（东市、西市、曲江、终南山、大明宫等）
- 主角：穿越而来的现代诗词爱好者

【人物模板要求】
请返回包含 ${count} 个完整对象的 JSON 数组，每个对象结构如下：
{
    "name": "三字姓名（姓+名，符合唐代取名习惯。姓氏如：李、杜、王、白、柳、崔等；名需文雅，如：清照、易安、摩诘、太白等风格，但禁止使用真实名人姓名）",
    "courtesyName": "表字（2字，如：太白、摩诘、少陵等风格）",
    "gender": "男或女",
    "age": 20-60 之间的整数,
    "identity": "身份职业（从以下选择：翰林学士、礼部侍郎、边塞将军、终南山隐士、西市商贾、曲江歌姬、寺观诗僧、名门闺秀、新科举人等）",
    "socialClass": "社会阶层（皇室/权贵/名门/寒门/市井/隐逸）",
    "poetryStyle": "诗风描述（20-40字，如：豪放飘逸、沉郁顿挫、清新自然、婉约含蓄、悲壮苍凉等）",
    "specialty": "擅长体裁（从以下选择：五言绝句/七言绝句/五言律诗/七言律诗/古风歌行/乐府诗）",
    "signatureWork": "代表作（一首完整的诗，需严格符合格律。五言绝句20字，七言绝句28字，律诗56字）",
    "signatureWorkTitle": "代表作诗题（2-4字）",
    "reputation": 声望值（0-100的整数，影响诗会邀请和朝堂机会）,
    "charm": 魅力值（30-80的整数，影响社交）,
    "literaryTalent": 文采值（40-90的整数，影响诗词创作质量）,
    "socialInfluence": 社交影响力（0-50的整数，影响人脉资源）,
    "introduction": "人物介绍（50-80字，包含出身背景、性格特点、诗词偏好、在长安城的社交圈层。需符合唐代社会背景，如：出身世族，曾游历西域，诗风豪放；或，终南山隐居，不仕朝堂，诗风清幽）"
}

【生成要求】
1. 生成恰好 ${count} 位不同身份和诗风的文人
2. 男女比例大致均衡（如 4男2女或3男3女）
3. 年龄分布合理（20-35岁青壮年为主，40-60岁名士为辅）
4. 社会阶层需多样化（涵盖权贵、寒门、市井、隐逸）
5. 诗风需与身份和性格统一（如：边塞将军写"边塞诗"，闺秀写"闺怨诗"）
6. 所有诗作必须严格符合格律（偶数句押韵，律诗中间两联对仗）
7. 所有数值必须是整数
8. 所有字段必须填写具体内容，禁止留空

【重要提示】
- 只返回 JSON 数组，开头必须是 [，结尾必须是 ]
- 不要任何其他文字说明`;
}

/**
 * Prompt 2：月度场景创作生成
 */
const sceneSystemPrompt = `你是唐代长安城的事件记录官，擅长用诗歌记录生活片段。

【核心任务】
根据当前季节、天气、主角位置、社交活动，生成1-2件本月的诗兴事件。

【生成原则】
1. 事件必须符合唐代长安背景（如：曲江雅集、东市购墨、终南山游历、大明宫应制等）
2. 每次事件需伴随一首诗，诗作需严格符合格律
3. 诗作质量需符合主角当前的文采值（文采低时，诗风简单；文采高时，诗风成熟）
4. 避免现代词汇，使用唐代用语（如：长安、曲江、终南山、大明宫、翰林院等）
5. 事件描述需50-100字，包含时间、地点、人物、活动、情感`;

function generateMonthlyScenePrompt() {
    const { world, protagonist, characters } = gameData;
    const season = world.season;
    const weather = world.weather;
    const month = world.month;
    const location = world.currentLocation || '长安城';
    const literaryTalent = protagonist.stats.literaryTalent || 30;
    const poetName = protagonist.name || '游子';
    
    const seasonThemes = {
        '春': ['曲江踏青', '杏园赏花', '灞桥折柳', '上巳节'],
        '夏': ['避暑终南山', '曲江夜宴', '雷雨观荷', '槐阴读书'],
        '秋': ['重阳登高', '曲江赏菊', '枫林怀古', '中秋赏月'],
        '冬': ['雪中探梅', '围炉夜话', '冬至祭祖', '冰嬉']
    };
    
    const possibleThemes = seasonThemes[season] || [];
    const theme = possibleThemes[Math.floor(Math.random() * possibleThemes.length)];
    
    return `请为《大唐古诗穿越记》生成本月的诗兴事件。

【主角信息】
- 姓名：${poetName}
- 当前位置：${location}
- 文采值：${literaryTalent}/100（文采低=诗句简单，文采高=诗句成熟）
- 社交圈子：${characters.length} 位文人朋友

【当前环境】
- 时间：${world.yearTitle}${world.year}年${month}月
- 季节：${season}
- 天气：${weather}
- 推荐主题：${theme}

【生成任务】
请生成 1-2 件本月的诗兴事件，返回 JSON 对象：
{
    "events": [
        {
            "title": "事件标题（10字以内，如：曲江踏青、终南山游历、曲江夜宴等）",
            "description": "事件描述（50-100字，包含时间、地点、人物、活动、情感。需符合唐代长安背景，如：${season}月${weather}，前往${location}，与友人${theme}，诗兴大发）",
            "poemType": "诗体（五言绝句/七言绝句/五言律诗/七言律诗）",
            "poemTitle": "诗题（2-4字）",
            "poemContent": "诗句（需严格符合格律。五言绝句20字，七言绝句28字，五言律诗40字，七言律诗56字。用空格分隔句，每句内部不用空格）",
            "poetryCommentary": "诗意解读（30-50字，解释诗句意境和典故）",
            "literaryTalentChange": 文采值变化（+1到+5的整数，基于诗作质量）,
            "reputationChange": 声望值变化（0到+10的整数，如果诗作被传颂）
        }
    ]
}

【生成要求】
1. 生成 1-2 个事件（不是更多，也不是更少）
2. 诗作必须严格符合格律（偶数句押韵，律诗中间两联对仗）
3. 诗作质量需与主角文采值匹配（文采${literaryTalent}：${literaryTalent < 40 ? '用词简单，意境清新' : literaryTalent < 70 ? '格律工整，意境深远' : '用典自然，意境浑然'}）
4. 事件描述需使用唐代用语（如：长安、曲江、终南山、大明宫、翰林院、东市、西市等）
5. 避免现代词汇（如：公园、商场、酒店等）
6. 只返回 JSON 对象，不要任何其他文字说明`;
}

/**
 * Prompt 3：诗会雅集生成
 */
const poetryPartySystemPrompt = `你是唐代长安诗会的主持者，擅长组织文人雅集。

【核心任务】
组织一场诗会，邀请多位文人参与，每人需根据主题创作一首诗。

【生成原则】
1. 诗会主题需符合唐代文化（如：曲江春宴、终南山秋游、大明宫应制等）
2. 参与者需根据各自诗风创作（豪放者写边塞，婉约者写闺怨）
3. 诗作需严格符合格律
4. 诗会结果需评选出"魁首"，给予声望奖励`;

function generatePoetryPartyPrompt(participants) {
    const { world, protagonist } = gameData;
    const season = world.season;
    const location = world.currentLocation || '曲江池';
    
    const partyThemes = {
        '春': '曲江春宴，以"春"为题',
        '夏': '曲江夜宴，以"月"为题',
        '秋': '重阳登高，以"秋"为题',
        '冬': '雪中探梅，以"雪"为题'
    };
    
    const theme = partyThemes[season] || '曲江雅集，自由创作';
    
    return `你是唐代长安诗会的组织者。请严格按照以下要求生成 JSON 数据。

## 诗会信息
地点：${location}
主题：${theme}
季节：${season}
参与人数：${participants.length}人

## 参与者
${participants.map((p, i) => `${i+1}. ${p.name} - ${p.identity} - 诗风:${p.poetryStyle} - 文采:${p.literaryTalent || 50}`).join('\n')}

## 生成要求

请返回 JSON 对象（不要包含任何其他文字或标记），格式如下：

{"partyTitle":"诗会名称","partyDescription":"诗会描述","champion":"魁首姓名","championReason":"魁首理由","participants":[{"name":"诗人姓名","poemType":"五言绝句","poemTitle":"诗题","poemContent":"诗句","poetryCommentary":"诗意解读","ranking":1,"reputationChange":10}]}

重要：所有参与者必须包含在 participants 数组中。`;
    ]
}

【生成要求】
1. 所有参与者必须创作一首诗
2. 诗作必须严格符合格律（偶数句押韵，律诗中间两联对仗）
3. 诗作需符合参与者各自的诗风（豪放者写边塞，婉约者写闺怨）
4. 魁首需合理选择（通常文采值最高或诗风最符合主题者）
5. 只返回 JSON 对象，不要任何其他文字说明`;
}

/**
 * Prompt 4：朝堂考试（殿试赋诗）
 */
const examSystemPrompt = `你是唐代科举考试的考官，精通诗文格律与典故。

【核心任务】
出题要求考生赋诗，根据诗作质量评定等第。

【评分标准】
1. 格律准确（平仄、押韵、对仗）——基础分
2. 立意深远——加分项
3. 用典恰当——加分项
4. 气象宏大——加分项
5. 禁止套用前人成句，要求原创

【等第划分】
- 一甲：格律完美，立意深远，用典自然（文采≥90）
- 二甲：格律准确，立意清晰（文采70-89）
- 三甲：格律基本正确（文采50-69）
- 落榜：格律错误或内容空洞（文采<50）`;

function generateExamPrompt(examType = '进士科') {
    const { world, protagonist } = gameData;
    const season = world.season;
    const literaryTalent = protagonist.stats.literaryTalent || 30;
    
    const examThemes = {
        '进士科': ['咏史怀古', '边塞军旅', '田园风光'],
        '明经科': ['经史注疏', '圣人教化'],
        '制举': ['时务对策', '治国安邦']
    };
    
    const possibleThemes = examThemes[examType] || examThemes['进士科'];
    const theme = possibleThemes[Math.floor(Math.random() * possibleThemes.length)];
    
    return `请为《大唐古诗穿越记》组织一场科举考试。

【考试信息】
- 科目：${examType}
- 地点：${examType === '进士科' ? '大明宫' : '国子监'}
- 主题：${theme}
- 季节：${season}

【考生信息】
- 姓名：${protagonist.name || '考生'}
- 文采值：${literaryTalent}/100

【生成任务】
请返回 JSON 对象：
{
    "examTitle": "考试名称（10字以内，如：进士科殿试、明经科会试、制举等）",
    "examQuestion": "考题描述（30-50字，说明诗作要求。如：以"${theme}"为题，创作一首七言律诗）",
    "requiredFormat": "格式要求（10字以内，如：五言律诗/七言律诗）",
    "timeLimit": "考试时长（10字以内，如：一个时辰）",
    "examinerComment": "考官评语（40-80字，对考生诗作的评价，需文雅古风）",
    "grade": "等第（一甲/二甲/三甲/落榜）",
    "gradeReason": "等第理由（30-50字，说明为何获得此等第）",
    "poemType": "诗体（需符合格式要求）",
    "poemTitle": "诗题（2-4字，需符合考题主题）",
    "poemContent": "诗句（需严格符合格律。五言绝句20字，七言绝句28字，五言律诗40字，七言律诗56字。用空格分隔句）",
    "literaryTalentChange": 文采值变化（0到+10的整数，基于考试表现）,
    "reputationChange": 声望值变化（落榜-5，三甲+5，二甲+10，一甲+20）,
    "careerAdvancement": 是否获得官职（true/false，一甲可能获得官职）,
    "newTitle": 新官职（仅当 careerAdvancement 为 true 时填写，如：翰林院编修、礼部员外郎等）
}

【生成要求】
1. 考题需符合唐代科举历史（进士科考诗赋，明经科考经义）
2. 诗作必须严格符合格式要求的格律
3. 等第需与考生文采值合理匹配（文采${literaryTalent}：${literaryTalent < 50 ? '落榜' : literaryTalent < 70 ? '三甲' : literaryTalent < 90 ? '二甲' : '一甲'}）
4. 考官评语需文雅古风，符合唐代语境
5. 只返回 JSON 对象，不要任何其他文字说明`;
}

/**
 * Prompt 5：AI 辅助诗词创作（灵韵补全）
 */
const completionSystemPrompt = `你是唐代诗词大师，擅长根据前半句补全诗句。

【核心任务】
根据玩家输入的诗句前半部分，创作符合格律的后半部分。

【创作原则】
1. 补全部分必须符合格律（平仄、押韵）
2. 意境需与前半部分协调统一
3. 避免套用前人成句，要求原创
4. 补全质量需符合主角当前文采值`;

function generatePoetryCompletionPrompt(userInput, format = '五言绝句') {
    const literaryTalent = gameData.protagonist.stats.literaryTalent || 30;
    
    return `请为《大唐古诗穿越记》补全诗句。

【玩家输入】
${userInput}

【格式要求】
${format}

【文采值】
${literaryTalent}/100

【生成任务】
请返回 JSON 对象：
{
    "completedPoem": "补全后的完整诗作（需严格符合格律。五言绝句20字，七言绝句28字，五言律诗40字，七言律诗56字。用空格分隔句）",
    "playerLines": "玩家输入的诗句（原封不动返回）",
    "aiLines": "AI补全的诗句（需与玩家输入诗句衔接自然）",
    "poetryCommentary": "诗意解读（30-50字）",
    "literaryTalentChange": 文采值变化（+1到+3的整数，基于补全质量）
}

【生成要求】
1. 补全部分必须符合格律（偶数句押韵，律诗中间两联对仗）
2. 补全质量需与主角文采值匹配（文采${literaryTalent}：${literaryTalent < 40 ? '用词简单' : '格律工整'}）
3. 只返回 JSON 对象，不要任何其他文字说明`;
}

// ==================== 工具函数 ====================

/**
 * 调用 AI API（GitHub Pages 静态托管版本 - 无需 CORS 代理）
 */
async function callAI(prompt, systemPrompt = '', retryCount = 0, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const useStream = options.stream || false;
    const timeoutMs = options.timeout || 180000;

    const baseUrl = gameData.settings.apiBaseUrl || 'https://api.openai.com/v1';
    const apiKey = gameData.settings.apiKey;
    const model = gameData.settings.model || 'gpt-3.5-turbo';

    if (!apiKey) throw new Error('请先配置API Key');
    if (!baseUrl) throw new Error('请先配置API地址');

    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const requestBody = {
            model: model,
            messages: messages,
            temperature: 0.8,
            stream: useStream
        };

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401 || response.status === 403) {
                throw new Error('API Key 无效或权限不足');
            } else if (response.status === 429) {
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
                    return callAI(prompt, systemPrompt, retryCount + 1, options);
                }
                throw new Error('API 请求过于频繁，请稍后重试');
            } else if (response.status >= 500) {
                if (retryCount < maxRetries) {
                    return callAI(prompt, systemPrompt, retryCount + 1, options);
                }
                throw new Error('API 服务器错误，请稍后重试');
            }
            throw new Error(`API 调用失败：${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        return content;

    } catch (error) {
        if (error.name === 'AbortError' && retryCount < maxRetries) {
            return callAI(prompt, systemPrompt, retryCount + 1, {
                ...options,
                timeout: timeoutMs + 60000
            });
        }
        throw error;
    }
}

/**
 * 提取 JSON（复用《桃源记》逻辑，支持智能修复）
 */
function extractJSON(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('API返回内容为空，请重试');
    }
    
    let cleaned = text.trim();
    
    cleaned = cleaned
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '');
    
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    
    let jsonMatch = arrayMatch || objectMatch;
    
    if (jsonMatch) {
        let fixed = jsonMatch[0]
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']')
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            .replace(/:\s*'([^']*)'/g, ': "$1"')
            .replace(/：/g, ':')
            .replace(/，/g, ',');
        
        const smartFixed = smartTruncateJSON(fixed);
        if (smartFixed) {
            return smartFixed;
        }
        
        try {
            JSON.parse(fixed);
            return fixed;
        } catch (e) {
            // 尝试智能截断
        }
    }
    
    throw new Error('API返回格式错误，无法解析JSON数据，请重试');
}

/**
 * 智能截断 JSON（修复被截断的 JSON）
 */
function smartTruncateJSON(jsonStr) {
    try {
        return JSON.stringify(JSON.parse(jsonStr));
    } catch (e) {
        const stack = [];
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < jsonStr.length; i++) {
            const char = jsonStr[i];
            
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            
            if (char === '"') {
                inString = !inString;
                continue;
            }
            
            if (!inString) {
                if (char === '{' || char === '[') {
                    stack.push(char);
                } else if (char === '}' || char === ']') {
                    stack.pop();
                    if (stack.length === 0) {
                        const truncated = jsonStr.substring(0, i + 1);
                        try {
                            JSON.parse(truncated);
                            return truncated;
                        } catch (e) {}
                    }
                }
            }
        }
        
        return null;
    }
}

/**
 * 保存游戏数据到 localStorage
 */
function saveGameData() {
    try {
        const dataStr = JSON.stringify(gameData);
        const dataSize = new Blob([dataStr]).size;
        
        if (dataSize > STORAGE_CONFIG.CRITICAL_THRESHOLD) {
            cleanupOldData();
        }
        
        localStorage.setItem('tangPoetryGame', dataStr);
        return true;
    } catch (error) {
        console.error('保存游戏数据失败:', error);
        if (error.name === 'QuotaExceededError') {
            cleanupOldData();
            try {
                localStorage.setItem('tangPoetryGame', JSON.stringify(gameData));
                return true;
            } catch (e) {
                console.error('清理后仍无法保存:', e);
            }
        }
        return false;
    }
}

/**
 * 加载游戏数据
 */
function loadGameData() {
    try {
        const savedData = localStorage.getItem('tangPoetryGame');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            gameData = { ...createDefaultGameData(), ...parsed };
            return true;
        }
    } catch (error) {
        console.error('加载游戏数据失败:', error);
    }
    return false;
}

/**
 * 清理旧数据
 */
function cleanupOldData() {
    if (gameData.chronicles.length > STORAGE_CONFIG.MAX_CHRONICLES) {
        gameData.chronicles = gameData.chronicles.slice(-STORAGE_CONFIG.MAX_CHRONICLES);
    }
    
    if (gameData.poetryCollection.length > STORAGE_CONFIG.MAX_POETRY_COLLECTION) {
        gameData.poetryCollection = gameData.poetryCollection.slice(-STORAGE_CONFIG.MAX_POETRY_COLLECTION);
    }
    
    if (gameData.aiHistory.length > STORAGE_CONFIG.MAX_AI_HISTORY) {
        gameData.aiHistory = gameData.aiHistory.slice(-STORAGE_CONFIG.MAX_AI_HISTORY);
    }
}

// ==================== 核心功能函数 ====================

/**
 * 初始化游戏（生成主角和初始文人）
 */
async function startNewGame(playerName, gender = '女') {
    gameData = createDefaultGameData();
    gameData.protagonist.name = playerName;
    gameData.protagonist.gender = gender;
    gameData.gameStarted = true;
    
    // 生成初始文人
    await generatePoets(6);
    
    saveGameData();
    return gameData;
}

/**
 * 生成文人角色
 */
async function generatePoets(count = 6) {
    const userPrompt = generatePoetsPrompt(count);
    
    try {
        const response = await callAI(userPrompt, poetSystemPrompt);
        const result = extractJSON(response);
        const poets = JSON.parse(result);
        
        poets.forEach(poet => {
            gameData.characters.push({
                id: 'poet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name: poet.name,
                courtesyName: poet.courtesyName,
                gender: poet.gender,
                age: poet.age,
                identity: poet.identity,
                socialClass: poet.socialClass,
                poetryStyle: poet.poetryStyle,
                specialty: poet.specialty,
                signatureWork: poet.signatureWork,
                signatureWorkTitle: poet.signatureWorkTitle,
                reputation: poet.reputation,
                charm: poet.charm,
                literaryTalent: poet.literaryTalent,
                socialInfluence: poet.socialInfluence,
                intro: poet.introduction,
                relations: {},
                isPoet: true
            });
        });
        
        // 记录到记事
        gameData.chronicles.push({
            id: 'chr_poets_generated_' + Date.now(),
            date: {
                year: gameData.world.year,
                month: gameData.world.month,
                yearTitle: gameData.world.yearTitle
            },
            content: `在${gameData.world.townName}结识了${count}位文人雅士：${poets.map(p => p.name).join('、')}。`,
            characters: poets.map(p => p.name),
            type: '结识'
        });
        
        saveGameData();
        
        return poets;
        
    } catch (error) {
        console.error('生成文人角色失败:', error);
        throw error;
    }
}

/**
 * 处理月度场景事件
 */
async function processMonthlySceneEvent() {
    if (!gameData.settings.apiKey || !gameData.settings.apiBaseUrl) {
        console.log('无API配置，跳过月度场景事件处理');
        return;
    }
    
    const userPrompt = generateMonthlyScenePrompt();
    
    try {
        const response = await callAI(userPrompt, sceneSystemPrompt);
        const result = extractJSON(response);
        const data = JSON.parse(result);
        
        if (result.events && Array.isArray(result.events)) {
            for (const event of result.events) {
                // 应用属性变化
                if (event.literaryTalentChange) {
                    gameData.protagonist.stats.literaryTalent = Math.max(0, Math.min(100, 
                        (gameData.protagonist.stats.literaryTalent || 0) + event.literaryTalentChange));
                }
                if (event.reputationChange) {
                    gameData.protagonist.stats.reputation = Math.max(-100, Math.min(100, 
                        (gameData.protagonist.stats.reputation || 0) + event.reputationChange));
                }
                
                // 收集诗稿
                gameData.poetryCollection.push({
                    id: 'poem_' + Date.now(),
                    title: event.poemTitle,
                    content: event.poemContent,
                    type: event.poemType,
                    commentary: event.poetryCommentary,
                    date: {
                        year: gameData.world.year,
                        month: gameData.world.month,
                        yearTitle: gameData.world.yearTitle
                    }
                });
                
                gameData.protagonist.poetryCount++;
                
                // 记录到记事
                gameData.chronicles.push({
                    id: 'chr_scene_' + Date.now(),
                    date: {
                        year: gameData.world.year,
                        month: gameData.world.month,
                        yearTitle: gameData.world.yearTitle
                    },
                    content: `${event.description}\n\n诗题：《${event.poemTitle}》\n${event.poemContent}\n\n${event.poetryCommentary}`,
                    characters: [gameData.protagonist.name],
                    type: '诗兴'
                });
            }
            
            saveGameData();
        }
        
        return data;
        
    } catch (error) {
        console.error('生成月度场景事件失败:', error);
        throw error;
    }
}

/**
 * 组织诗会雅集
 */
async function organizePoetryParty() {
    if (!gameData.settings.apiKey || !gameData.settings.apiBaseUrl) {
        throw new Error('请先配置API才能参加诗会');
    }

    // 选择参与者（文采值最高的5位文人）
    const eligiblePoets = gameData.characters
        .filter(c => c.isPoet && (c.literaryTalent || 50) >= 30)
        .sort((a, b) => (b.literaryTalent || 50) - (a.literaryTalent || 50))
        .slice(0, 5);

    if (eligiblePoets.length < 3) {
        throw new Error('文人不足，无法举办诗会。请先结识更多文人。');
    }

    const participants = [gameData.protagonist, ...eligiblePoets];
    const userPrompt = generatePoetryPartyPrompt(participants);

    try {
        const response = await callAI(userPrompt, poetryPartySystemPrompt);
        const result = extractJSON(response);

        // 调试：打印 AI 返回的原始数据
        console.log('AI 返回的原始数据：', result);

        const data = JSON.parse(result);

        // 验证数据格式
        console.log('==== 开始验证数据结构 ===');
        console.log('data 对象的键：', Object.keys(data));
        
        // 尝试查找 participants 字段（无论它在哪里）
        let participantsData = data.participants;
        let participantsSource = 'participants';
        
        if (!participantsData || !Array.isArray(participantsData)) {
            console.log('participants 字段不存在或不是数组，查找其他可能...');
            
            // 尝试查找常见的变体
            const possibleKeys = ['participant', 'Participant', 'partipant', 'Poets', 'poets', 'PoetList', 'poetList'];
            for (const key of possibleKeys) {
                if (data[key] && Array.isArray(data[key])) {
                    participantsData = data[key];
                    participantsSource = key;
                    console.log(`找到数据在字段 "${key}"`);
                    break;
                }
            }
        }
        
        console.log('participantsSource：', participantsSource);
        console.log('participants 类型：', typeof participantsData);
        console.log('participants 是否为数组：', Array.isArray(participantsData));
        console.log('participants 值：', participantsData);
        console.log('participants 长度：', participantsData ? participantsData.length : 'undefined');
        
        if (!participantsData || !Array.isArray(participantsData) || participantsData.length === 0) {
            console.error('完整数据：', data);
            throw new Error(`AI 返回的数据中找不到有效的 participants 数组。字段包括：${Object.keys(data).join(', ')}。`);
        }
        
        if (!Array.isArray(data.participants)) {
            console.error('participants 不是数组，实际类型：', typeof data.participants);
            console.error('participants 实际值：', data.participants);
            throw new Error(`AI 返回的 participants 字段不是数组，实际类型：${typeof data.participants}。请重试。`);
        }

        if (!data.partyDescription) {
            throw new Error('AI 返回的数据缺少 partyDescription 字段');
        }

        if (!data.champion) {
            throw new Error('AI 返回的数据缺少 champion 字段');
        }
        
        console.log('==== 数据验证通过 ====');

        if (!data.participants || !Array.isArray(data.participants)) {
            console.error('数据格式错误：', data);
            throw new Error('AI 返回的数据格式不正确（缺少 participants 数组）。请重试。');
        }

        if (!data.partyDescription) {
            throw new Error('AI 返回的数据缺少 partyDescription 字段');
        }

        if (!data.champion) {
            throw new Error('AI 返回的数据缺少 champion 字段');
        }
        
        // 处理诗会结果
        const partyRecord = {
            id: 'party_' + Date.now(),
            title: data.partyTitle,
            description: data.partyDescription,
            champion: data.champion,
            championReason: data.championReason,
            date: {
                year: gameData.world.year,
                month: gameData.world.month,
                yearTitle: gameData.world.yearTitle
            },
            participants: []
        };
        
        data.participants.forEach(p => {
            const character = participants.find(c => c.name === p.name);
            if (character) {
                // 应用声望变化
                if (p.reputationChange) {
                    if (character.id === 'protagonist') {
                        gameData.protagonist.stats.reputation = Math.max(-100, Math.min(100, 
                            (gameData.protagonist.stats.reputation || 0) + p.reputationChange));
                    } else {
                        character.reputation = Math.max(0, Math.min(100, 
                            (character.reputation || 0) + p.reputationChange));
                    }
                }
                
                // 收集诗作
                gameData.poetryCollection.push({
                    id: 'poem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    title: p.poemTitle,
                    content: p.poemContent,
                    type: p.poemType,
                    author: p.name,
                    commentary: p.poetryCommentary,
                    ranking: p.ranking,
                    date: {
                        year: gameData.world.year,
                        month: gameData.world.month,
                        yearTitle: gameData.world.yearTitle
                    }
                });
                
                if (character.id === 'protagonist') {
                    gameData.protagonist.poetryCount++;
                }
                
                partyRecord.participants.push({
                    name: p.name,
                    poemTitle: p.poemTitle,
                    poemContent: p.poemContent,
                    ranking: p.ranking,
                    reputationChange: p.reputationChange
                });
            }
        });
        
        // 记录诗会
        gameData.poetryPartyRecords.push(partyRecord);
        
        // 记录到记事
        gameData.chronicles.push({
            id: 'chr_poetry_party_' + Date.now(),
            date: {
                year: gameData.world.year,
                month: gameData.world.month,
                yearTitle: gameData.world.yearTitle
            },
            content: `参加${data.partyTitle}，${data.partyDescription}。魁首：${data.champion}。${data.championReason}`,
            characters: participants.map(p => p.name),
            type: '诗会'
        });
        
        saveGameData();
        
        return data;
        
    } catch (error) {
        console.error('组织诗会失败:', error);
        throw error;
    }
}

/**
 * 朝堂考试
 */
async function takeExam(examType = '进士科') {
    if (!gameData.settings.apiKey || !gameData.settings.apiBaseUrl) {
        throw new Error('请先配置API才能参加考试');
    }
    
    const userPrompt = generateExamPrompt(examType);
    
    try {
        const response = await callAI(userPrompt, examSystemPrompt);
        const result = extractJSON(response);
        const data = JSON.parse(result);
        
        // 应用属性变化
        if (data.literaryTalentChange) {
            gameData.protagonist.stats.literaryTalent = Math.max(0, Math.min(100, 
                (gameData.protagonist.stats.literaryTalent || 0) + data.literaryTalentChange));
        }
        if (data.reputationChange) {
            gameData.protagonist.stats.reputation = Math.max(-100, Math.min(100, 
                (gameData.protagonist.stats.reputation || 0) + data.reputationChange));
        }
        
        // 如果获得官职，更新身份
        if (data.careerAdvancement && data.newTitle) {
            gameData.protagonist.identity = data.newTitle;
            gameData.protagonist.career = data.newTitle;
            gameData.protagonist.careerLevel = data.grade === '一甲' ? 5 : data.grade === '二甲' ? 4 : 3;
        }
        
        // 收集诗作
        gameData.poetryCollection.push({
            id: 'exam_poem_' + Date.now(),
            title: data.poemTitle,
            content: data.poemContent,
            type: data.poemType,
            examType: examType,
            grade: data.grade,
            commentary: data.examinerComment,
            date: {
                year: gameData.world.year,
                month: gameData.world.month,
                yearTitle: gameData.world.yearTitle
            }
        });
        
        // 记录考试
        gameData.examRecords.push({
            id: 'exam_' + Date.now(),
            examTitle: data.examTitle,
            examQuestion: data.examQuestion,
            grade: data.grade,
            poemTitle: data.poemTitle,
            poemContent: data.poemContent,
            careerAdvancement: data.careerAdvancement,
            newTitle: data.newTitle,
            date: {
                year: gameData.world.year,
                month: gameData.world.month,
                yearTitle: gameData.world.yearTitle
            }
        });
        
        // 记录到记事
        gameData.chronicles.push({
            id: 'chr_exam_' + Date.now(),
            date: {
                year: gameData.world.year,
                month: gameData.world.month,
                yearTitle: gameData.world.yearTitle
            },
            content: `参加${data.examTitle}，考题：${data.examQuestion}。\n\n诗作：《${data.poemTitle}》\n${data.poemContent}\n\n考官评语：${data.examinerComment}\n\n等第：${data.grade}。${data.gradeReason}${data.careerAdvancement ? ` 获得官职：${data.newTitle}` : ''}`,
            characters: [gameData.protagonist.name],
            type: '科举'
        });
        
        saveGameData();
        
        return data;
        
    } catch (error) {
        console.error('参加考试失败:', error);
        throw error;
    }
}

/**
 * AI 辅助诗词创作（灵韵补全）
 */
async function completePoetry(userInput, format = '五言绝句') {
    if (!gameData.settings.apiKey || !gameData.settings.apiBaseUrl) {
        throw new Error('请先配置API才能使用AI辅助创作');
    }
    
    const userPrompt = generatePoetryCompletionPrompt(userInput, format);
    
    try {
        const response = await callAI(userPrompt, completionSystemPrompt);
        const result = extractJSON(response);
        const data = JSON.parse(result);
        
        // 应用文采值变化
        if (data.literaryTalentChange) {
            gameData.protagonist.stats.literaryTalent = Math.max(0, Math.min(100, 
                (gameData.protagonist.stats.literaryTalent || 0) + data.literaryTalentChange));
        }
        
        // 收集诗作
        const poemId = 'ai_poem_' + Date.now();
        gameData.poetryCollection.push({
            id: poemId,
            title: '无题',
            content: data.completedPoem,
            type: format,
            author: gameData.protagonist.name,
            isAICreated: true,
            playerLines: data.playerLines,
            aiLines: data.aiLines,
            commentary: data.poetryCommentary,
            date: {
                year: gameData.world.year,
                month: gameData.world.month,
                yearTitle: gameData.world.yearTitle
            }
        });
        
        gameData.protagonist.poetryCount++;
        
        // 记录到记事
        gameData.chronicles.push({
            id: 'chr_ai_poem_' + Date.now(),
            date: {
                year: gameData.world.year,
                month: gameData.world.month,
                yearTitle: gameData.world.yearTitle
            },
            content: `使用"灵韵补全"功能创作诗词。\n\n我写道：${data.playerLines}\n${data.aiLines}\n\n${data.poetryCommentary}`,
            characters: [gameData.protagonist.name],
            type: '创作'
        });
        
        saveGameData();
        
        return data;
        
    } catch (error) {
        console.error('AI补全诗词失败:', error);
        throw error;
    }
}

/**
 * 推进到下一个月
 */
async function nextMonth() {
    gameData.world.month++;
    if (gameData.world.month > 12) {
        gameData.world.month = 1;
        gameData.world.year++;
    }
    
    // 更新年号（每30年换一次）
    if (gameData.world.year % 30 === 1 && gameData.world.month === 1) {
        const yearTitles = ['开元', '天宝', '贞观', '永徽', '调露', '神龙', '景龙', '先天', '乾封'];
        const currentIndex = yearTitles.indexOf(gameData.world.yearTitle);
        gameData.world.yearTitle = yearTitles[(currentIndex + 1) % yearTitles.length];
    }
    
    // 更新季节
    const month = gameData.world.month;
    if ([3, 4, 5].includes(month)) gameData.world.season = '春';
    else if ([6, 7, 8].includes(month)) gameData.world.season = '夏';
    else if ([9, 10, 11].includes(month)) gameData.world.season = '秋';
    else gameData.world.season = '冬';
    
    // 更新天气
    const weathers = ['晴', '阴', '雨', '雪', '雾'];
    gameData.world.weather = weathers[Math.floor(Math.random() * weathers.length)];
    
    // 随机决定本月是否有诗会或考试
    gameData.world.isPoetryPartyMonth = Math.random() < 0.3; // 30%概率有诗会
    gameData.world.isExamMonth = gameData.world.month === 3 || gameData.world.month === 9; // 春秋两季有考试
    
    // 生成月度场景事件
    try {
        await processMonthlySceneEvent();
    } catch (error) {
        console.error('月度场景事件生成失败:', error);
    }
    
    saveGameData();
    
    return gameData;
}

/**
 * 导出游戏数据
 */
function exportGameData() {
    const dataStr = JSON.stringify(gameData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tang_poetry_save_${gameData.world.yearTitle}${gameData.world.year}年${gameData.world.month}月.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * 导入游戏数据
 */
function importGameData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                gameData = { ...createDefaultGameData(), ...data };
                saveGameData();
                resolve(gameData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// ==================== 对外暴露的 API ====================

// ==================== API 管理功能 ====================

/**
 * 测试 API 连接（支持 CORS 代理）
 */
async function testAPIConnection() {
    const { apiBaseUrl, apiKey } = gameData.settings;
    
    // 设置连接状态为测试中
    gameData.settings.connectionStatus = 'testing';
    saveGameData();
    
    try {
        // 尝试直接连接
        let response = await fetch(`${apiBaseUrl}/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        // 如果直接连接失败，尝试使用 CORS 代理
        if (!response.ok && response.status === 0) {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`${apiBaseUrl}/models`)}`;
            response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        
        if (response.ok) {
            gameData.settings.connectionStatus = 'success';
            saveGameData();
            return {
                success: true,
                message: '连接成功！API 配置有效',
                status: response.status
            };
        } else {
            const errorText = await response.text();
            gameData.settings.connectionStatus = 'failed';
            saveGameData();
            return {
                success: false,
                message: `连接失败 (HTTP ${response.status}): ${errorText}`,
                status: response.status
            };
        }
    } catch (error) {
        gameData.settings.connectionStatus = 'failed';
        saveGameData();
        return {
            success: false,
            message: `网络错误: ${error.message}`,
            error: error.message
        };
    }
}

/**
 * 获取可用模型列表（支持 CORS 代理）
 */
async function fetchAvailableModels() {
    const { apiBaseUrl, apiKey } = gameData.settings;
    
    try {
        // 尝试直接获取
        let response = await fetch(`${apiBaseUrl}/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        // 如果直接获取失败，尝试使用 CORS 代理
        if (!response.ok) {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`${apiBaseUrl}/models`)}`;
            response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 提取模型列表（适配 OpenAI 格式和可能的变体）
        let models = [];
        if (data.data && Array.isArray(data.data)) {
            models = data.data.map(m => m.id);
        } else if (data.models && Array.isArray(data.models)) {
            models = data.models.map(m => m.id);
        }
        
        // 过滤出大语言模型（排除 embedding、whisper、image 等模型）
        const chatModels = models.filter(id => 
            id.includes('gpt') || 
            id.includes('gemini') || 
            id.includes('claude') ||
            id.includes('chat') ||
            id.includes('llm') ||
            id.includes('instruct')
        );
        
        // 更新可用模型列表
        if (chatModels.length > 0) {
            gameData.settings.availableModels = chatModels;
            gameData.settings.lastModelFetch = new Date().toISOString();
            
            // 如果当前模型不在可用列表中，切换到第一个可用模型
            if (!chatModels.includes(gameData.settings.model)) {
                gameData.settings.model = chatModels[0];
            }
            
            saveGameData();
            
            return {
                success: true,
                models: chatModels,
                message: `成功获取 ${chatModels.length} 个可用模型`
            };
        } else {
            return {
                success: false,
                models: gameData.settings.availableModels,
                message: '未找到可用的大语言模型，使用默认模型列表'
            };
        }
    } catch (error) {
        console.error('获取模型列表失败:', error);
        return {
            success: false,
            models: gameData.settings.availableModels,
            message: `获取失败: ${error.message}，使用默认模型列表`
        };
    }
}

/**
 * 更新 API 设置
 */
function updateSettings(newSettings) {
    if (!newSettings || typeof newSettings !== 'object') {
        throw new Error('设置参数无效');
    }
    
    // 更新允许的字段
    const allowedFields = ['apiBaseUrl', 'apiKey', 'model'];
    
    for (const key of allowedFields) {
        if (newSettings.hasOwnProperty(key)) {
            gameData.settings[key] = newSettings[key];
        }
    }
    
    // 重置连接状态
    gameData.settings.connectionStatus = 'unknown';
    
    saveGameData();
    
    return gameData.settings;
}

// 浏览器环境：暴露到全局 window 对象
if (typeof window !== 'undefined') {
    window.tangPoetryGame = {
        createDefaultGameData,
        startNewGame,
        generatePoets,
        processMonthlySceneEvent,
        organizePoetryParty,
        takeExam,
        completePoetry,
        nextMonth,
        saveGameData,
        loadGameData,
        exportGameData,
        importGameData,
        getGameData: () => gameData,
        testAPIConnection,
        fetchAvailableModels,
        updateSettings
    };
}

// Node.js 环境：使用 module.exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createDefaultGameData,
        startNewGame,
        generatePoets,
        processMonthlySceneEvent,
        organizePoetryParty,
        takeExam,
        completePoetry,
        nextMonth,
        saveGameData,
        loadGameData,
        exportGameData,
        importGameData,
        getGameData: () => gameData,
        testAPIConnection,
        fetchAvailableModels,
        updateSettings,
        // 兼容旧版HTML
        organizePoetryParty: organizePoetryParty
    };
}
