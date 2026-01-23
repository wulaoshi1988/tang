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

const MONTHLY_EVENT_TYPES = {
    POETRY_INSPIRATION: '诗词灵感',
    SEASONAL_ACTIVITY: '季节活动',
    HISTORICAL_EVENT: '历史事件',
    RANDOM_ENCOUNTER: '偶遇文人',
    CELEBRITY_VISIT: '名士来访'
};

const MOOD_TYPES = ['欣喜', '平静', '忧愁', '愤怒', '感伤', '豪迈'];

const GIFT_ITEMS = [
    { id: 'wine', name: '美酒', price: 100, intimacyBonus: 5, description: '一壶佳酿，醉人心脾' },
    { id: 'tea', name: '名贵茶叶', price: 300, intimacyBonus: 8, description: '顾渚紫笋，清香四溢' },
    { id: 'stationery', name: '文房四宝', price: 200, intimacyBonus: 10, description: '湖笔徽墨，宣纸端砚' },
    { id: 'book', name: '珍本书籍', price: 500, intimacyBonus: 15, description: '孤本典籍，价值连城' },
    { id: 'painting', name: '名家字画', price: 800, intimacyBonus: 20, description: '丹青妙笔，意境深远' },
    { id: 'guqin', name: '古琴', price: 1000, intimacyBonus: 25, description: '焦尾遗音，高山流水' }
];

const TANG_ERAS = {
    '初唐': { years: '618-712', description: '唐朝建立至玄宗开元前' },
    '盛唐': { years: '712-762', description: '开元盛世至安史之乱' },
    '中唐': { years: '762-827', description: '安史之乱后至文宗时期' },
    '晚唐': { years: '827-907', description: '文宗后至唐朝灭亡' }
};

// ==================== 游戏默认数据 ====================

function createDefaultGameData() {
    return {
        // API 配置（已预设）
        settings: {
            apiBaseUrl: '',
            apiKey: '',
            model: 'gpt-3.5-turbo',  // 默认模型
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
        dialogueHistory: {},               // 对话历史 { poet_id: [{role, content, timestamp}] }
        currentMonthEvents: [],            // 当月事件列表
        gameStarted: false
    };
}

let gameData = createDefaultGameData();
let blobUrlCache = new Map();

// ==================== Prompt 定义 ====================

/**
 * Prompt 1：真实唐代诗人系统生成
 */
const poetSystemPrompt = `你是唐代文学史专家，精通唐代诗人生平与作品。

【核心原则】
1. 必须生成真实的唐代历史诗人（如李白、杜甫、王维、白居易等）
2. 诗人资料必须符合历史事实（生卒年、字号、官职、代表作等）
3. 代表作必须是该诗人的真实作品，不可杜撰
4. 诗风描述需准确反映该诗人的创作特点
5. 人物介绍需包含真实的历史背景和生平事迹`;

function generatePoetsPrompt(count = 6) {
    const eraExamples = {
        '初唐': '王勃、杨炯、卢照邻、骆宾王、陈子昂、宋之问',
        '盛唐': '李白、杜甫、王维、孟浩然、王昌龄、高适、岑参',
        '中唐': '白居易、韩愈、柳宗元、刘禹锡、元稹、贾岛',
        '晚唐': '李商隐、杜牧、温庭筠、韦庄、罗隐'
    };
    
    return `请为《大唐古诗穿越记》生成 ${count} 位真实的唐代历史诗人。

【重要】必须是真实存在的唐代诗人，资料需符合历史事实！

【各时期代表诗人参考】
- 初唐（618-712）：${eraExamples['初唐']}
- 盛唐（712-762）：${eraExamples['盛唐']}
- 中唐（762-827）：${eraExamples['中唐']}
- 晚唐（827-907）：${eraExamples['晚唐']}

【人物模板要求】
请返回包含 ${count} 个完整对象的 JSON 数组，每个对象结构如下：
{
    "name": "诗人姓名（真实历史人物，如：李白、杜甫、王维）",
    "courtesyName": "表字（真实的，如：太白、子美、摩诘）",
    "nickname": "号或别称（如：诗仙、诗圣、诗佛）",
    "gender": "男或女",
    "birthYear": 出生年份（如701）,
    "deathYear": 去世年份（如762）,
    "era": "所属时期（初唐/盛唐/中唐/晚唐）",
    "identity": "主要身份官职（真实的，如：翰林供奉、左拾遗、尚书右丞）",
    "birthplace": "籍贯（如：陇西成纪、巩县、太原祁县）",
    "poetryStyle": "诗风描述（20-40字，准确描述该诗人的创作风格特点）",
    "specialty": "擅长体裁（如：七言绝句、五言律诗、古风歌行、乐府诗）",
    "signatureWork": "代表作原文（必须是该诗人的真实作品，完整诗句）",
    "signatureWorkTitle": "代表作诗题（真实诗题）",
    "literaryTalent": 文采值（70-100的整数，根据历史地位评定）,
    "reputation": 声望值（50-100的整数，根据当时及后世影响力）,
    "introduction": "人物介绍（80-150字，包含真实的生平事迹、重要经历、文学成就、与其他诗人的交往等历史信息）",
    "famousQuotes": ["名句1", "名句2", "名句3"]
}

【生成要求】
1. 生成恰好 ${count} 位不同时期的真实唐代诗人
2. 尽量覆盖不同时期（初唐、盛唐、中唐、晚唐）
3. 所有信息必须符合历史事实
4. 代表作必须是该诗人的真实作品
5. 名句必须是该诗人的真实诗句
6. 所有数值必须是整数
7. 不要生成重复的诗人

【重要提示】
- 只返回 JSON 数组，开头必须是 [，结尾必须是 ]
- 不要任何其他文字说明`;
}

/**
 * Prompt 2：月度事件系统（增强版）
 */
const monthlyEventSystemPrompt = `你是唐代长安城的事件记录官，擅长记录文人生活中的各类事件。

【核心任务】
根据当前季节、天气、主角位置、社交关系，生成1-3件本月的事件。

【事件类型】
1. 诗词灵感：触发诗词创作，需生成一首诗
2. 季节活动：曲江踏青、重阳登高等节令活动
3. 历史事件：边关战报、朝堂变动等大事件
4. 偶遇文人：街头邂逅某位文人，触发对话
5. 名士来访：有名望的文人主动拜访

【生成原则】
1. 事件必须符合唐代长安背景
2. 诗词灵感事件需伴随一首诗，诗作需符合格律
3. 偶遇文人事件需指定一位已认识的文人
4. 避免现代词汇，使用唐代用语
5. 事件描述需50-100字`;

const sceneSystemPrompt = monthlyEventSystemPrompt;

function generateMonthlyScenePrompt() {
    const { world, protagonist, characters } = gameData;
    const season = world.season;
    const weather = world.weather;
    const month = world.month;
    const location = world.currentLocation || '长安城';
    const literaryTalent = protagonist.stats.literaryTalent || 30;
    const reputation = protagonist.stats.reputation || 0;
    const poetName = protagonist.name || '游子';
    
    const seasonThemes = {
        '春': ['曲江踏青', '杏园赏花', '灞桥折柳', '上巳节'],
        '夏': ['避暑终南山', '曲江夜宴', '雷雨观荷', '槐阴读书'],
        '秋': ['重阳登高', '曲江赏菊', '枫林怀古', '中秋赏月'],
        '冬': ['雪中探梅', '围炉夜话', '冬至祭祖', '冰嬉']
    };
    
    const historicalEvents = [
        '边关急报：突厥来犯',
        '朝堂风云：宰相更替',
        '天灾预警：久旱求雨',
        '盛世庆典：万国来朝',
        '文坛盛事：翰林院征诗'
    ];
    
    const possibleThemes = seasonThemes[season] || [];
    const theme = possibleThemes[Math.floor(Math.random() * possibleThemes.length)];
    const historicalEvent = historicalEvents[Math.floor(Math.random() * historicalEvents.length)];
    
    const knownPoets = characters.filter(c => c.isPoet).slice(0, 3);
    const poetsInfo = knownPoets.map(p => `${p.name}（${p.identity}）`).join('、') || '暂无';
    
    return `请为《大唐古诗穿越记》生成本月的事件。

【主角信息】
- 姓名：${poetName}
- 当前位置：${location}
- 文采值：${literaryTalent}/100
- 声望值：${reputation}
- 已结识文人：${poetsInfo}

【当前环境】
- 时间：${world.yearTitle}${world.year}年${month}月
- 季节：${season}
- 天气：${weather}
- 季节活动推荐：${theme}
- 近期历史事件：${historicalEvent}

【生成任务】
请生成 1-3 件本月事件，返回 JSON 对象：
{
    "events": [
        {
            "eventType": "事件类型（诗词灵感/季节活动/历史事件/偶遇文人/名士来访）",
            "title": "事件标题（10字以内）",
            "description": "事件描述（50-100字）",
            "involvedPoetId": "涉及的文人ID（仅偶遇文人/名士来访时填写，从已结识文人中选择，否则为null）",
            "involvedPoetName": "涉及的文人姓名（仅偶遇文人/名士来访时填写）",
            "openingLine": "文人开场白（仅偶遇文人/名士来访时填写，30-50字，符合该文人性格和诗风）",
            "poemType": "诗体（仅诗词灵感事件需要）",
            "poemTitle": "诗题（仅诗词灵感事件需要）",
            "poemContent": "诗句（仅诗词灵感事件需要，用空格分隔句）",
            "poetryCommentary": "诗意解读（仅诗词灵感事件需要）",
            "literaryTalentChange": 文采值变化（0到+5的整数）,
            "reputationChange": 声望值变化（-5到+10的整数）,
            "charmChange": 魅力值变化（0到+3的整数）
        }
    ]
}

【生成要求】
1. 生成 1-3 个不同类型的事件
2. 至少包含 1 个诗词灵感或季节活动事件
3. 有 30% 概率包含偶遇文人事件（从已结识文人中选择）
4. 诗作需符合格律，质量匹配文采值
5. 偶遇文人事件的开场白需符合该文人的性格和诗风
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

    重要：所有参与者必须包含在 participants 数组中。

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

/**
 * Prompt 6：文人对话系统
 */
const dialogueSystemPrompt = `你是唐代长安城的一位文人，正在与主角进行对话。

【核心任务】
根据文人的身份、性格、诗风，生成符合人物特点的对话回复。

【对话原则】
1. 回复必须符合文人的身份和性格（如：隐士淡泊，名门矜持，歌姬婉转）
2. 语言风格需古雅，符合唐代文人用语
3. 可适当引用诗句或即兴作诗
4. 对话需有情感起伏，影响好感度
5. 回复长度30-100字`;

function generateDialoguePrompt(poet, playerMessage, dialogueContext = []) {
    const { protagonist } = gameData;
    const relation = protagonist.relations[poet.id] || { intimacy: 0, mood: '平静' };
    
    const recentDialogue = dialogueContext.slice(-6).map(d => 
        `${d.role === 'player' ? protagonist.name : poet.name}：${d.content}`
    ).join('\n');
    
    return `你现在扮演唐代文人「${poet.name}」，正在与「${protagonist.name}」对话。

【文人信息】
- 姓名：${poet.name}（${poet.courtesyName || '无表字'}）
- 身份：${poet.identity}
- 性格诗风：${poet.poetryStyle}
- 代表作：《${poet.signatureWorkTitle}》
- 人物介绍：${poet.intro || poet.introduction}

【当前关系】
- 亲密度：${relation.intimacy}（-100到100，负数为敌对，正数为友好）
- 当前情绪：${relation.mood || '平静'}

【对话历史】
${recentDialogue || '（首次对话）'}

【玩家说】
${playerMessage}

【生成任务】
请返回 JSON 对象：
{
    "reply": "文人的回复（30-100字，符合人物性格，语言古雅）",
    "mood": "回复后的情绪（欣喜/平静/忧愁/愤怒/感伤/豪迈）",
    "intimacyChange": 亲密度变化（-10到+10的整数，基于对话内容）,
    "poetryGift": "赠诗（可选，当对话氛围很好时，文人可能赠送一首诗，格式：诗题|诗句，用空格分隔句。若无则为null）",
    "actionHint": "动作提示（可选，描述文人的动作或表情，如：轻抚胡须、掩面而笑、眉头微蹙。若无则为null）"
}

【生成要求】
1. 回复必须符合「${poet.name}」的性格（${poet.poetryStyle}）
2. 语言需古雅，避免现代用语
3. 亲密度变化需合理（好话+分，冒犯-分）
4. 赠诗需符合格律（可选，仅在特殊时刻）
5. 只返回 JSON 对象，不要任何其他文字说明`;
}

function generateDialogueOpeningPrompt(poet, context = '') {
    return `你现在扮演唐代文人「${poet.name}」，正在向「${gameData.protagonist.name}」打招呼。

【文人信息】
- 姓名：${poet.name}
- 身份：${poet.identity}
- 性格诗风：${poet.poetryStyle}

【场景】
${context || '在长安城街头偶遇'}

【生成任务】
请返回 JSON 对象：
{
    "greeting": "开场白（30-50字，符合人物性格，语言古雅）",
    "mood": "当前情绪（欣喜/平静/忧愁/感伤/豪迈）",
    "actionHint": "动作提示（如：拱手作揖、微微点头）"
}

只返回 JSON 对象，不要任何其他文字说明`;
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

function normalizeJsonText(text) {
    let cleaned = text
        .replace(/\uFEFF/g, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/：/g, ':')
        .replace(/，/g, ',')
        .replace(/\r\n/g, '\n')
        .replace(/\u2028/g, '\n')
        .replace(/\u2029/g, '\n');

    return escapeJsonLineBreaks(cleaned);
}

function escapeJsonLineBreaks(text) {
    let out = '';
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (escapeNext) {
            out += char;
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            out += char;
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            out += char;
            continue;
        }

        if (inString) {
            if (char === '\n' || char === '\r') {
                out += '\\n';
                continue;
            }
            if (char === '\t') {
                out += '\\t';
                continue;
            }
        }

        out += char;
    }

    return out;
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
    
    cleaned = normalizeJsonText(cleaned);

    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    
    let jsonMatch = arrayMatch || objectMatch;

    if (!jsonMatch) {
        const firstIndex = cleaned.search(/[\[{]/);
        const lastIndex = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'));
        if (firstIndex !== -1 && lastIndex !== -1 && lastIndex > firstIndex) {
            jsonMatch = [cleaned.slice(firstIndex, lastIndex + 1)];
        }
    }
    
    if (jsonMatch) {
        let fixed = jsonMatch[0]
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']')
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            .replace(/:\s*'([^']*)'/g, ': "$1"');
        
        fixed = normalizeJsonText(fixed);

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

function getPersistableGameData(data) {
    const cloned = JSON.parse(JSON.stringify(data));
    if (cloned.settings) {
        cloned.settings.apiKey = '';
    }
    return cloned;
}

/**
 * 保存游戏数据到 localStorage
 */
function saveGameData() {
    try {
        const dataStr = JSON.stringify(getPersistableGameData(gameData));
        const dataSize = new Blob([dataStr]).size;
        
        if (dataSize > STORAGE_CONFIG.CRITICAL_THRESHOLD) {
            cleanupOldData();
        }
        
        const finalDataStr = JSON.stringify(getPersistableGameData(gameData));
        localStorage.setItem('tangPoetryGame', finalDataStr);
        return true;
    } catch (error) {
        console.error('保存游戏数据失败:', error);
        if (error.name === 'QuotaExceededError') {
            cleanupOldData();
            try {
                const finalDataStr = JSON.stringify(getPersistableGameData(gameData));
                localStorage.setItem('tangPoetryGame', finalDataStr);
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
            if (parsed.settings) {
                parsed.settings.apiKey = '';
            }
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
    const savedSettings = gameData.settings;
    
    gameData = createDefaultGameData();
    gameData.settings = savedSettings;
    gameData.protagonist.name = playerName;
    gameData.protagonist.gender = gender;
    gameData.gameStarted = true;
    
    try {
        await generatePoets(6);
    } catch (error) {
        console.error('生成诗人失败:', error);
        gameData.characters = [];
    }
    
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
            const existingPoet = gameData.characters.find(c => c.name === poet.name);
            if (existingPoet) return;
            
            gameData.characters.push({
                id: 'poet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name: poet.name,
                courtesyName: poet.courtesyName,
                nickname: poet.nickname || '',
                gender: poet.gender || '男',
                birthYear: poet.birthYear,
                deathYear: poet.deathYear,
                era: poet.era,
                identity: poet.identity,
                birthplace: poet.birthplace,
                poetryStyle: poet.poetryStyle,
                specialty: poet.specialty,
                signatureWork: poet.signatureWork,
                signatureWorkTitle: poet.signatureWorkTitle,
                reputation: poet.reputation || 80,
                literaryTalent: poet.literaryTalent || 85,
                intro: poet.introduction,
                famousQuotes: poet.famousQuotes || [],
                isHistorical: true,
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
        return { events: [] };
    }
    
    const userPrompt = generateMonthlyScenePrompt();
    
    try {
        const response = await callAI(userPrompt, monthlyEventSystemPrompt);
        const result = extractJSON(response);
        const data = JSON.parse(result);
        
        const processedEvents = [];
        
        if (data.events && Array.isArray(data.events)) {
            for (const event of data.events) {
                const processedEvent = {
                    id: 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    eventType: event.eventType || '诗词灵感',
                    title: event.title,
                    description: event.description,
                    involvedPoetId: event.involvedPoetId || null,
                    involvedPoetName: event.involvedPoetName || null,
                    openingLine: event.openingLine || null,
                    date: {
                        year: gameData.world.year,
                        month: gameData.world.month,
                        yearTitle: gameData.world.yearTitle
                    }
                };
                
                if (event.literaryTalentChange) {
                    gameData.protagonist.stats.literaryTalent = Math.max(0, Math.min(100, 
                        (gameData.protagonist.stats.literaryTalent || 0) + event.literaryTalentChange));
                    processedEvent.literaryTalentChange = event.literaryTalentChange;
                }
                if (event.reputationChange) {
                    gameData.protagonist.stats.reputation = Math.max(-100, Math.min(100, 
                        (gameData.protagonist.stats.reputation || 0) + event.reputationChange));
                    processedEvent.reputationChange = event.reputationChange;
                }
                if (event.charmChange) {
                    gameData.protagonist.stats.charm = Math.max(0, Math.min(100, 
                        (gameData.protagonist.stats.charm || 0) + event.charmChange));
                    processedEvent.charmChange = event.charmChange;
                }
                
                if (event.eventType === '诗词灵感' && event.poemContent) {
                    gameData.poetryCollection.push({
                        id: 'poem_' + Date.now(),
                        title: event.poemTitle,
                        content: event.poemContent,
                        type: event.poemType,
                        commentary: event.poetryCommentary,
                        date: processedEvent.date
                    });
                    gameData.protagonist.poetryCount++;
                    
                    processedEvent.poemTitle = event.poemTitle;
                    processedEvent.poemContent = event.poemContent;
                    processedEvent.poemType = event.poemType;
                    processedEvent.poetryCommentary = event.poetryCommentary;
                }
                
                let chronicleContent = event.description;
                if (event.poemContent) {
                    chronicleContent += `\n\n诗题：《${event.poemTitle}》\n${event.poemContent}`;
                    if (event.poetryCommentary) {
                        chronicleContent += `\n\n${event.poetryCommentary}`;
                    }
                }
                
                gameData.chronicles.push({
                    id: 'chr_event_' + Date.now(),
                    date: processedEvent.date,
                    content: chronicleContent,
                    characters: event.involvedPoetName ? [gameData.protagonist.name, event.involvedPoetName] : [gameData.protagonist.name],
                    type: event.eventType
                });
                
                processedEvents.push(processedEvent);
            }
            
            gameData.currentMonthEvents = processedEvents;
            saveGameData();
        }
        
        return { events: processedEvents };
        
    } catch (error) {
        console.error('生成月度事件失败:', error);
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

        let data = JSON.parse(result);

        // 如果 AI 返回的是数组（而不是对象），尝试转换为对象格式
        if (Array.isArray(data)) {
            const participantsList = data;
            // 从 ranking 找出魁首
            const championEntry = participantsList.find(p => p.ranking === 1) || participantsList[0];
            data = {
                partyTitle: gameData.world.season + '日诗会',
                partyDescription: '文人雅士齐聚一堂，吟诗作赋，共赏' + gameData.world.season + '光。',
                champion: championEntry ? championEntry.name : '',
                championReason: championEntry ? '诗作格律工整，意境深远，当为魁首。' : '',
                participants: participantsList
            };
        }

        // 验证数据格式
        
        // 尝试查找 participants 字段（无论它在哪里）
        let participantsData = data.participants;
        let participantsSource = 'participants';
        
        if (!participantsData || !Array.isArray(participantsData)) {
            
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
        
        if (!participantsData || !Array.isArray(participantsData) || participantsData.length === 0) {
            console.error('完整数据：', data);
            throw new Error(`AI 返回的数据中找不到有效的 participants 数组。字段包括：${Object.keys(data).join(', ')}。`);
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
        
        participantsData.forEach(p => {
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
    const dataStr = JSON.stringify(getPersistableGameData(gameData), null, 2);
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
                if (data.settings) {
                    data.settings.apiKey = '';
                }
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

// ==================== 对话系统函数 ====================

/**
 * 开始与文人对话
 */
async function startDialogue(poetId, context = '') {
    const poet = gameData.characters.find(c => c.id === poetId);
    if (!poet) {
        throw new Error('找不到该文人');
    }
    
    if (!gameData.dialogueHistory[poetId]) {
        gameData.dialogueHistory[poetId] = [];
    }
    
    if (!gameData.protagonist.relations[poetId]) {
        gameData.protagonist.relations[poetId] = {
            intimacy: 0,
            mood: '平静',
            lastChat: null
        };
    }
    
    try {
        const prompt = generateDialogueOpeningPrompt(poet, context);
        const response = await callAI(prompt, dialogueSystemPrompt);
        const result = extractJSON(response);
        const data = JSON.parse(result);
        
        const dialogueEntry = {
            role: 'poet',
            content: data.greeting,
            timestamp: Date.now(),
            mood: data.mood,
            actionHint: data.actionHint
        };
        
        gameData.dialogueHistory[poetId].push(dialogueEntry);
        gameData.protagonist.relations[poetId].mood = data.mood;
        gameData.protagonist.relations[poetId].lastChat = Date.now();
        
        if (gameData.dialogueHistory[poetId].length > 20) {
            gameData.dialogueHistory[poetId] = gameData.dialogueHistory[poetId].slice(-20);
        }
        
        saveGameData();
        
        return {
            poet: poet,
            greeting: data.greeting,
            mood: data.mood,
            actionHint: data.actionHint,
            relation: gameData.protagonist.relations[poetId]
        };
        
    } catch (error) {
        console.error('开始对话失败:', error);
        throw error;
    }
}

/**
 * 发送对话消息
 */
async function sendMessage(poetId, message) {
    const poet = gameData.characters.find(c => c.id === poetId);
    if (!poet) {
        throw new Error('找不到该文人');
    }
    
    if (!gameData.dialogueHistory[poetId]) {
        gameData.dialogueHistory[poetId] = [];
    }
    
    gameData.dialogueHistory[poetId].push({
        role: 'player',
        content: message,
        timestamp: Date.now()
    });
    
    try {
        const dialogueContext = gameData.dialogueHistory[poetId];
        const prompt = generateDialoguePrompt(poet, message, dialogueContext);
        const response = await callAI(prompt, dialogueSystemPrompt);
        const result = extractJSON(response);
        const data = JSON.parse(result);
        
        const dialogueEntry = {
            role: 'poet',
            content: data.reply,
            timestamp: Date.now(),
            mood: data.mood,
            actionHint: data.actionHint,
            poetryGift: data.poetryGift
        };
        
        gameData.dialogueHistory[poetId].push(dialogueEntry);
        
        if (!gameData.protagonist.relations[poetId]) {
            gameData.protagonist.relations[poetId] = { intimacy: 0, mood: '平静' };
        }
        
        const relation = gameData.protagonist.relations[poetId];
        relation.mood = data.mood;
        relation.intimacy = Math.max(-100, Math.min(100, 
            (relation.intimacy || 0) + (data.intimacyChange || 0)));
        relation.lastChat = Date.now();
        
        if (data.poetryGift) {
            const [poemTitle, poemContent] = data.poetryGift.split('|');
            if (poemTitle && poemContent) {
                gameData.poetryCollection.push({
                    id: 'gift_poem_' + Date.now(),
                    title: poemTitle.trim(),
                    content: poemContent.trim(),
                    type: '赠诗',
                    author: poet.name,
                    date: {
                        year: gameData.world.year,
                        month: gameData.world.month,
                        yearTitle: gameData.world.yearTitle
                    }
                });
            }
        }
        
        if (gameData.dialogueHistory[poetId].length > 20) {
            gameData.dialogueHistory[poetId] = gameData.dialogueHistory[poetId].slice(-20);
        }
        
        saveGameData();
        
        return {
            reply: data.reply,
            mood: data.mood,
            intimacyChange: data.intimacyChange || 0,
            currentIntimacy: relation.intimacy,
            poetryGift: data.poetryGift,
            actionHint: data.actionHint
        };
        
    } catch (error) {
        console.error('发送消息失败:', error);
        throw error;
    }
}

/**
 * 结束对话
 */
function endDialogue(poetId) {
    const relation = gameData.protagonist.relations[poetId];
    if (relation) {
        relation.lastChat = Date.now();
        
        gameData.chronicles.push({
            id: 'chr_dialogue_' + Date.now(),
            date: {
                year: gameData.world.year,
                month: gameData.world.month,
                yearTitle: gameData.world.yearTitle
            },
            content: `与${gameData.characters.find(c => c.id === poetId)?.name || '文人'}进行了一番交谈。当前亲密度：${relation.intimacy}`,
            characters: [gameData.protagonist.name, gameData.characters.find(c => c.id === poetId)?.name].filter(Boolean),
            type: '交谈'
        });
        
        saveGameData();
    }
    
    return relation;
}

/**
 * 获取与文人的对话历史
 */
function getDialogueHistory(poetId) {
    return gameData.dialogueHistory[poetId] || [];
}

/**
 * 获取与文人的关系状态
 */
function getRelation(poetId) {
    return gameData.protagonist.relations[poetId] || { intimacy: 0, mood: '平静', lastChat: null };
}

/**
 * 赠送礼物给诗人
 */
function giveGift(poetId, giftId) {
    const poet = gameData.characters.find(c => c.id === poetId);
    if (!poet) {
        throw new Error('找不到该诗人');
    }
    
    const gift = GIFT_ITEMS.find(g => g.id === giftId);
    if (!gift) {
        throw new Error('找不到该礼物');
    }
    
    if (gameData.protagonist.money < gift.price) {
        throw new Error(`铜钱不足，需要 ${gift.price} 文`);
    }
    
    gameData.protagonist.money -= gift.price;
    
    if (!gameData.protagonist.relations[poetId]) {
        gameData.protagonist.relations[poetId] = { intimacy: 0, mood: '平静', lastChat: null };
    }
    
    const relation = gameData.protagonist.relations[poetId];
    relation.intimacy = Math.min(100, (relation.intimacy || 0) + gift.intimacyBonus);
    
    gameData.chronicles.push({
        id: 'chr_gift_' + Date.now(),
        date: {
            year: gameData.world.year,
            month: gameData.world.month,
            yearTitle: gameData.world.yearTitle
        },
        content: `向${poet.name}赠送了${gift.name}。"${gift.description}"`,
        characters: [gameData.protagonist.name, poet.name],
        type: '赠礼'
    });
    
    saveGameData();
    
    return {
        poet: poet.name,
        gift: gift.name,
        intimacyChange: gift.intimacyBonus,
        currentIntimacy: relation.intimacy,
        remainingMoney: gameData.protagonist.money
    };
}

/**
 * 获取礼物列表
 */
function getGiftList() {
    return GIFT_ITEMS.map(gift => ({
        ...gift,
        canAfford: gameData.protagonist.money >= gift.price
    }));
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
        updateSettings,
        startDialogue,
        sendMessage,
        endDialogue,
        getDialogueHistory,
        getRelation,
        giveGift,
        getGiftList,
        MONTHLY_EVENT_TYPES,
        GIFT_ITEMS,
        TANG_ERAS
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
        startDialogue,
        sendMessage,
        endDialogue,
        getDialogueHistory,
        getRelation,
        giveGift,
        getGiftList,
        MONTHLY_EVENT_TYPES,
        GIFT_ITEMS,
        TANG_ERAS
    };
}

