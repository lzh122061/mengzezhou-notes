const db = wx.cloud.database();

Page({
  data: {
    // 定义11个图片位
    // type: 业务类型 (room/global)
    // key: 数据库字段名
    // name: 显示名称
    // dbId: 查询条件的值 (比如房间号)
    list: [
      { id: 1, name: '小程序首图', type: 'global', key: 'home_banner', currentUrl: '' },
      { id: 2, name: '101 照片', type: 'room', key: 'cover_image', dbId: '101', currentUrl: '' },
      { id: 3, name: '102 照片', type: 'room', key: 'cover_image', dbId: '102', currentUrl: '' },
      { id: 4, name: '103 照片', type: 'room', key: 'cover_image', dbId: '103', currentUrl: '' },
      { id: 5, name: '104 照片', type: 'room', key: 'cover_image', dbId: '104', currentUrl: '' },
      { id: 6, name: '105 照片', type: 'room', key: 'cover_image', dbId: '105', currentUrl: '' },
      { id: 7, name: '106 照片', type: 'room', key: 'cover_image', dbId: '106', currentUrl: '' },
      { id: 8, name: '107 照片', type: 'room', key: 'cover_image', dbId: '107', currentUrl: '' },
      { id: 9, name: '108 照片', type: 'room', key: 'cover_image', dbId: '108', currentUrl: '' },
      { id: 10, name: '共享厨房', type: 'global', key: 'kitchen_img', currentUrl: '' },
      { id: 11, name: '休闲公区', type: 'global', key: 'public_area_img', currentUrl: '' }
    ]
  },

  onLoad() {
    this.loadData();
  },

  // 加载当前图片数据
  async loadData() {
    wx.showLoading({ title: '加载中...' });
    const list = this.data.list;
    
    // 1. 获取全局配置图片 (首图、厨房、公区)
    try {
      // 假设全局配置存在 'config' 集合，且有一条记录
      const configRes = await db.collection('config').limit(1).get(); 
      if (configRes.data.length > 0) {
        const configData = configRes.data[0];
        
        list.forEach(item => {
          if (item.type === 'global') {
            if (configData[item.key]) {
              item.currentUrl = configData[item.key];
            }
          }
        });
      }

      // 2. 获取房间图片
      // 遍历所有房间类型的item，去rooms集合查
      const roomItems = list.filter(item => item.type === 'room');
      
      // 使用 Promise.all 并发查询
      const roomQueries = roomItems.map(item => {
        return db.collection('rooms').where({
          room_number: item.dbId // 假设数据库房间号字段为 room_number
        }).get().then(res => {
          if (res.data.length > 0) {
            return { id: item.id, url: res.data[0][item.key] };
          }
          return { id: item.id, url: '' };
        });
      });

      const roomResults = await Promise.all(roomQueries);
      
      roomResults.forEach(res => {
        const target = list.find(l => l.id === res.id);
        if (target) target.currentUrl = res.url;
      });

      this.setData({ list });

    } catch (err) {
      console.error('加载图片失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 处理上传点击
  handleUpload(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.list[index];

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFilePaths[0];
        this.uploadToCloud(filePath, item, index);
      }
    });
  },

  // 上传到云存储
  uploadToCloud(filePath, item, index) {
    wx.showLoading({ title: '上传中...' });
    
    const cloudPath = `images/${item.type}_${item.dbId || 'global'}_${Date.now()}.jpg`;

    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: res => {
        console.log('上传成功', res.fileID);
        this.updateDatabase(res.fileID, item, index);
      },
      fail: err => {
        console.error('上传失败', err);
        wx.hideLoading();
        wx.showToast({ title: '上传出错', icon: 'none' });
      }
    });
  },

  // 更新数据库
  updateDatabase(fileId, item, index) {
    let promise;

    if (item.type === 'room') {
      // 更新房间集合
      promise = db.collection('rooms').where({
        room_number: item.dbId
      }).update({
        data: {
          [item.key]: fileId
        }
      });
    } else {
      // 更新全局配置集合
      // 这里假设只有一条config记录，如果不确定ID，可以先查再更，或者写死ID
      // 为了演示，这里假设更新第一条
      promise = db.collection('config').where({
        // 这里的条件视你数据库而定，如果没有特定ID，可以用一个总的标识
        // 或者直接用 doc('config_id')
        // 暂时用 generic update
        _openid: '{openid}' // 这是一个占位，实际最好用 docId
      }).limit(1).update({ // update 必须有条件或docId，这里是个演示难点
         // 建议实际使用： db.collection('config').doc('你的config_doc_id').update(...)
         // 现在的降级策略：先查到ID再更新
         data: {
           [item.key]: fileId
         }
      });
      
      // 更稳妥的写法：先查 config 的 _id
      promise = db.collection('config').limit(1).get().then(res => {
        if (res.data.length > 0) {
           return db.collection('config').doc(res.data[0]._id).update({
             data: { [item.key]: fileId }
           });
        }
      });
    }

    promise.then(() => {
      wx.hideLoading();
      wx.showToast({ title: '更新成功' });
      
      // 更新本地视图
      const key = `list[${index}].currentUrl`;
      this.setData({
        [key]: fileId
      });
    }).catch(err => {
      console.error('数据库更新失败', err);
      wx.hideLoading();
      wx.showToast({ title: '存库失败', icon: 'none' });
    });
  },
  
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    if(url) {
      wx.previewImage({
        urls: [url],
      });
    }
  }
});