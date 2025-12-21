const db = wx.cloud.database();
const CLOUD_BASE = 'cloud://cloud1-7gvskpoo2a3897dc-1392473051';
// --- 1. 本地静态数据 (保留原本的丰富描述) ---
const ROOM_FACILITIES = ['100M独享WiFi', '独立卫浴', '干湿分离','24h热水', '乳胶床垫', '冷暖空调', '写字桌','单人沙发2个','小茶几', '吹风机', '山泉水入户', '电动车'];

const ROOM_DATABASE = {
  // === 客房部分 ===
  '101': {
    picCount: 3,
    tags: ['静谧', '私密', '一楼'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积27㎡，朝南超大开窗，窗外为院内花坛，下午阳光会把树影照进屋内，非常舒服。房间隐私好，阳光好，地基高不潮湿，最安静阳光最好的一个房间'
  },
  '102': {
    picCount: 3,
    tags: ['苍山田园', '景观', '白噪声'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积24㎡，窗户朝向为北，整体较为阴凉（夏天特别舒服）。下午2点后会有阳光直射。窗外可看到苍山，可以听到苍山溪流白噪声。'
  },
  '103': {
    picCount: 3,
    tags: ['舒适套房', '超大空间', '写论文首选'],
    facilities: ROOM_FACILITIES,
    desc: '一室一厅小套房，老房子改造而成，面积30㎡，套房客厅被客人们誉为“最适合写论文”的地方。'
  },
  '201': {
    picCount: 3,
    tags: ['温暖阳光', '全天采光', '看苍山'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积27㎡，有朝南和朝西两个大窗户，全天采光。窗外可以看到苍山。午后的阳光会洒满整个床铺，非常治愈。'
  },
  '202': {
    picCount: 3,
    tags: ['苍山田园', '顶层视野', '开阔'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积24㎡，朝北大开窗，位于102的正上方，看苍山视野更加开阔，田园风光一览无余。'
  },
  '203': {
    picCount: 3,
    tags: ['庭院阳光', '俯瞰内庭', '隐私好'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积27㎡，朝南大开窗，朝北两个单扇窗，面对内部庭院，既有阳光又兼顾隐私。'
  },
  '301': {
    picCount: 3,
    tags: ['顶层', '温暖阳光', '无敌视角'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积24㎡，朝南朝西两个大开窗，位于201的楼上，无敌的阳光和看苍山的视角。'
  },
  '302': {
    picCount: 3,
    tags: ['庭院阳光', '顶层', '安静'],
    facilities: ROOM_FACILITIES,
    desc: '房间面积27㎡，朝南大开窗，面对内部庭院，顶层视野与采光的终极选择。'
  },

  // === 公区部分 ===
  'kitchen': {
    name: '共享厨房', 
    picCount: 2,
    tags: ['全套厨具', '自助', '烟火气'],
    facilities: ['双开门冰箱', '微波炉', '中西式调料', '电饭煲', '破壁机', '空气炸锅', '电热水壶', '炒锅', '砂锅'],
    desc: '提供齐全的厨具和基础调料，只需要自行购买食材，即可在大理享受烹饪乐趣。'
  },
  'public': {
    name: '休闲公区', 
    picCount: 4,
    tags: ['娱乐', '咖啡', '阅读', '治愈'],
    facilities: ['三只猫管家','全自动咖啡机', '桌游', '上百本书籍', '黑胶唱片机', '吉他', '尤克里里', '电钢琴','switch游戏机', '绘画颜料', '65寸电视', '100寸投影','射箭'],
    desc: '这是孟沢洲的社交心脏，连接着陌生与相识。提供书籍、黑胶、游戏机等丰富娱乐。'
  }
};

Page({
  data: { 
    room: {},
    navHeight: 0,
    statusBarHeight: 0
  },

  onLoad(options) {
    // 获取系统信息以适配灵动岛和胶囊按钮
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    
    // 计算避开顶部 UI 的高度
    const statusBarHeight = systemInfo.statusBarHeight;
    const navHeight = menuButtonInfo.bottom + (menuButtonInfo.top - statusBarHeight);

    this.setData({
      statusBarHeight: statusBarHeight,
      navHeight: navHeight
    });

    if (options.id) {
      this.initRoomData(options.id);
    }
  },

  // --- 初始化数据 ---
  initRoomData(id) {
    wx.showLoading({ title: '加载中...' });

    // 1. 先获取本地静态数据作为“底子” (包含兜底图片逻辑)
    let localInfo = ROOM_DATABASE[id] || ROOM_DATABASE['101'];
    
    // 初始化本地图片路径 (这就是如果云端没图时读取的“兜底图片”)
    localInfo.images = [];
    for (let i = 1; i <= (localInfo.picCount || 3); i++) {
      localInfo.images.push(`${CLOUD_BASE}/rooms/${id}/${i}.jpg`);
    }
    
    if (!localInfo.name) localInfo.name = `孟沢洲·${id}`;

    // 2. 准备数据库查询 Promise
    let fetchPromise;

    // === 核心修改：区分查询逻辑 ===
    // 如果是公区或厨房，去 config 集合查
    if (id === 'kitchen' || id === 'public') {
        fetchPromise = db.collection('config').limit(1).get().then(res => {
            // 构造一个伪装的 room 对象，以便复用后面的逻辑
            let mockRoomData = {};
            if (res.data.length > 0) {
                const config = res.data[0];

                // --- 修改逻辑：支持多张图片 ---
                // 优先找 images 数组，如果没找到，找 img 单图并转为数组
                
                if (id === 'kitchen') {
                    // 1. 尝试读取 kitchen_images (假设使用了新字段存数组)
                    if (config.kitchen_images && Array.isArray(config.kitchen_images)) {
                        mockRoomData.images = config.kitchen_images;
                    } 
                    // 2. 尝试读取 kitchen_img (兼容旧字段，或者旧字段现在存的是数组)
                    else if (config.kitchen_img) {
                        mockRoomData.images = Array.isArray(config.kitchen_img) ? config.kitchen_img : [config.kitchen_img];
                    }
                } 
                else if (id === 'public') {
                    // 1. 尝试读取 public_area_images
                    if (config.public_area_images && Array.isArray(config.public_area_images)) {
                        mockRoomData.images = config.public_area_images;
                    } 
                    // 2. 尝试读取 public_area_img
                    else if (config.public_area_img) {
                        mockRoomData.images = Array.isArray(config.public_area_img) ? config.public_area_img : [config.public_area_img];
                    }
                }
            }
            // 返回数组格式，模拟 rooms 查询结果
            return { data: [mockRoomData] }; 
        });
    } else {
        // 如果是普通房间，去 rooms 集合查
        fetchPromise = db.collection('rooms').where({ id: id }).get();
    }

    // 3. 执行查询并处理数据
    fetchPromise.then(res => {
      let cloudData = {};
      if (res.data.length > 0) {
        cloudData = res.data[0];
      }

      // 4. 组装最终数据
      const finalRoom = {
        ...localInfo, 
        ...cloudData 
      };

      // 5. 防止云端空描述覆盖本地丰富描述
      if (!cloudData.desc) {
        finalRoom.desc = localInfo.desc;
      }

      // 6. 核心：图片读取优先级逻辑
      // 优先级 A: 读取 Admin 后台上传的多张图片数组 (images) - 仅限客房，现在也适用于公区(因为上面构造了mockRoomData.images)
      if (cloudData.images && cloudData.images.length > 0) {
        finalRoom.images = cloudData.images;
      }
      // 优先级 B: 读取 Admin 后台上传的单张封面图 (cover_image)
      else if (cloudData.cover_image) {
        finalRoom.images = [cloudData.cover_image];
      }
      // 优先级 C: 如果上面都没有，finalRoom.images 保持为 localInfo.images (本地兜底图)

      this.setData({ room: finalRoom });
      wx.setNavigationBarTitle({ title: finalRoom.name });
      wx.hideLoading();

    }).catch(err => {
      console.error("加载云数据失败", err);
      // 如果云端加载失败，直接使用本地数据(含兜底图)
      this.setData({ room: localInfo });
      wx.hideLoading();
    });
  },
// 在 Page 对象中添加小圆点滑动组件
  onSwiperChange(e) {
    this.setData({
      currentSwiper: e.detail.current
    });
  },

  // 返回上一页逻辑
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({
        url: '/pages/home/index',
      });
    }
  }
});