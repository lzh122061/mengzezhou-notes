const db = wx.cloud.database();
// 基础地址 (用于兜底默认图)
const CLOUD_BASE = 'cloud://cloud1-7gvskpoo2a3897dc.636c-cloud1-7gvskpoo2a3897dc-1392473051';

const ROOM_META = {
  '101': { type: '客房', tag: '静谧空间 · 阳光充足' },
  '102': { type: '客房', tag: '苍山田园 · 景观大窗' },
  '103': { type: '客房', tag: '舒适套房 · 适合办公' },
  '201': { type: '客房', tag: '温暖采光 · 视野极佳' },
  '202': { type: '客房', tag: '苍山田园 · 顶层视野' },
  '203': { type: '客房', tag: '庭院阳光 · 俯瞰内庭' },
  '301': { type: '客房', tag: '顶层静谧 · 绝佳阳光' },
  '302': { type: '客房', tag: '视野开阔 · 顶层首选' }
};

Page({
  data: {
    navHeight: 0,
    banners: [],   // 轮播图数据
    topPoster: '', // 兼容字段
    roomList: []   
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this.setData({ navHeight: sys.statusBarHeight });
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const [configRes, roomsRes] = await Promise.all([
        db.collection('config').limit(1).get(),
        db.collection('rooms').orderBy('id', 'asc').get()
      ]);

      // ============================================
      // Part A. 首页轮播图处理 (完全参照房间逻辑)
      // ============================================
      let config = {};
      if (configRes.data.length > 0) {
        config = configRes.data[0];
      }

      let banners = [];

      // 1. 优先级一：数据库 (Admin后台上传的图)
      // 这里的 home_banner 存的就是 "cloud://.../images/..." 这种路径
      if (config.home_banner) {
        if (Array.isArray(config.home_banner)) {
          banners = config.home_banner; // 如果是多张
        } else {
          banners = [config.home_banner]; // 如果是单张，转为数组
        }
      } 
      
      // 2. 优先级二：兜底 (如果数据库没图，读默认路径)
      // 逻辑和房间的 `${CLOUD_BASE}/rooms/${id}/cover.jpg` 保持一致
      if (banners.length === 0) {
        banners = [`${CLOUD_BASE}/home/poster.jpg`];
      }

      // 更新 topPoster (兼容旧逻辑)
      const topPoster = banners.length > 0 ? banners[0] : '';


      // ============================================
      // Part B. 房间列表处理 (保持不变)
      // ============================================
      const dbRooms = roomsRes.data;
      
      let newRoomList = dbRooms.map(item => {
        const meta = ROOM_META[item.id] || { type: '客房', tag: '' };
        
        // 房间图片逻辑：优先DB -> 否则默认
        let imgUrl = item.cover_image;
        if (!imgUrl) {
          imgUrl = `${CLOUD_BASE}/rooms/${item.id}/cover.jpg`;
        }

        return {
          id: item.id,
          name: item.name,
          type: meta.type,
          tag: meta.tag,
          img: imgUrl 
        };
      });

      // 追加公区 (保持不变)
      newRoomList.push({
        id: 'kitchen',
        name: '共享厨房',
        type: '公区',
        tag: '全套厨具 · 烟火气息',
        img: config.kitchen_img || `${CLOUD_BASE}/rooms/kitchen/cover.jpg`
      });

      newRoomList.push({
        id: 'public',
        name: '休闲公区',
        type: '公区',
        tag: '阅读娱乐 · 社交中心',
        img: config.public_area_img || `${CLOUD_BASE}/rooms/public/cover.jpg`
      });

      this.setData({
        banners,
        topPoster,
        roomList: newRoomList
      });

    } catch (err) {
      console.error('首页加载数据失败', err);
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ 
      url: `/pages/detail/index?id=${id}` 
    });
  },

  navToMassage() {
    wx.reLaunch({ 
      url: '/pages/massage/index' 
    });
  },

  navToNotes() {
    wx.reLaunch({ 
      url: '/pages/notes/index' 
    });
  },

  navToMy() {
    wx.reLaunch({ 
      url: '/pages/index/index' 
    });
  }
});