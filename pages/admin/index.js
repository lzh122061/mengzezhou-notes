const db = wx.cloud.database();
const _ = db.command;

// ★★★ 核心修复1：云环境路径 (图片修复) ★★★
const CLOUD_BASE = 'cloud://cloud1-7gvskpoo2a3897dc.636c-cloud1-7gvskpoo2a3897dc-1392473051';

Page({
  data: {
    // === 1. 权限与登录 ===
    isAdmin: false,
    currentOpenId: '',
    inputPassword: '',
    adminPwd: '122061',

    // === 2. 模块展开/收起 ===
    sectionExpanded: {
      images: false,
      prices: false,
      calendar: false
    },

    // === 3. 业务数据 ===
    imageList: [],
    roomList: [],
    editingId: null,
    tempPrices: { day: '', holiday: '', week: '', half: '', month: '' },
    
    // ★ 新增：今日主理人心情数据
    todayMood: '',

    // === 4. 房态核心数据 ===
    roomIds: ['101', '102', '103', '201', '202', '203', '301', '302'],
    currentAdminRoom: '101',
    currentDateObj: new Date().getTime(),
    monthText: '',
    adminCalendarDays: [], 
    
    // 滑动相关变量
    gridRect: null,       
    isDragging: false,    
    dragStartIndex: -1,   
    dragEndIndex: -1,     
    dragTargetStatus: null, 
  },

  onLoad(options) {
    const cachedOpenId = wx.getStorageSync('openid');
    if (cachedOpenId) {
      this.setData({ currentOpenId: cachedOpenId });
      this.checkAdminStatus(cachedOpenId);
    } else {
      this.cloudLogin();
    }
  },

  cloudLogin() {
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        const openid = res.result.openid;
        wx.setStorageSync('openid', openid);
        this.setData({ currentOpenId: openid });
        this.checkAdminStatus(openid);
      },
      fail: err => { console.error(err); }
    })
  },

  checkAdminStatus: function (openid) {
    db.collection('admins').where({ openid: openid }).get().then(res => {
      if (res.data.length > 0) {
        this.setAdminAccess(true);
      } else if(openid === 'oDwJG1yI3Poum-CHoryAeqtPETu0') { 
        this.setAdminAccess(true);
      } else {
        this.setAdminAccess(false);
      }
    }).catch(err => {
      if(openid === 'oDwJG1yI3Poum-CHoryAeqtPETu0') this.setAdminAccess(true);
      else this.setAdminAccess(false);
    });
  },

  setAdminAccess(isAuth) {
    this.setData({ isAdmin: isAuth });
    wx.setStorageSync('isAdmin', isAuth);
    if (isAuth) { this.initData(); }
  },

  handlePasswordInput(e) { this.setData({ inputPassword: e.detail.value }); },
  
  verifyPassword() {
    if (this.data.inputPassword !== this.data.adminPwd) {
      wx.showToast({ title: '密码错误', icon: 'error' });
      return;
    }
    wx.showLoading({ title: '验证通过...' });
    db.collection('admins').add({
      data: { openid: this.data.currentOpenId, createTime: db.serverDate(), note: '密码登录自动添加' }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '登录成功', icon: 'success' });
      this.setAdminAccess(true);
    }).catch(() => {
      wx.hideLoading();
      this.setAdminAccess(true); 
    });
  },

  goBackToHome() { wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/home/index' }) }); },
  
  toggleSection(e) { 
    const key = e.currentTarget.dataset.key; 
    this.setData({ [`sectionExpanded.${key}`]: !this.data.sectionExpanded[key] }); 
    if (key === 'calendar' && this.data.sectionExpanded.calendar) { 
      setTimeout(() => { this.updateGridRect(); }, 300); 
    } 
  },
  
  async initData() {
    try {
      const res = await db.collection('rooms').orderBy('id', 'asc').get();
      this.setData({ roomList: res.data });
      
      const configRes = await db.collection('config').limit(1).get();
      const config = configRes.data.length > 0 ? configRes.data[0] : {};
      
      // ★ 新增：初始化提取主理人心情
      this.setData({
        todayMood: config.today_mood || ''
      });
      
      this.buildImageList(res.data, config);
      this.fetchAdminBookings();
    } catch (err) {
      console.error("Init data error:", err);
    }
  },

  // === ★ 新增：心情相关函数 ===
  onMoodInput(e) {
    this.setData({
      todayMood: e.detail.value
    });
  },

  async saveMood() {
    wx.showLoading({ title: '保存中...' });
    try {
      const res = await db.collection('config').limit(1).get();
      if (res.data.length > 0) {
        await db.collection('config').doc(res.data[0]._id).update({
          data: { today_mood: this.data.todayMood }
        });
      } else {
        await db.collection('config').add({
          data: { today_mood: this.data.todayMood }
        });
      }
      wx.hideLoading();
      wx.showToast({ title: '心情更新成功', icon: 'success' });
    } catch (err) {
      console.error('保存心情失败', err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
  // ==========================

  // === 图片管理部分 (修复版) ===
  buildImageList(rooms, config) {
    const list = [];
    
    // 1. 首页 Banner
    let homeBannerUrl = config.home_banner || [];
    if (!Array.isArray(homeBannerUrl)) homeBannerUrl = [homeBannerUrl];
    homeBannerUrl = homeBannerUrl.filter(u => u && u.startsWith('cloud://'));
    list.push({ id: 'global_home', name: '小程序首图', type: 'global', key: 'home_banner', currentUrl: homeBannerUrl[0] || '' });
    
    // 2. 共享厨房
    let kitchenUrl = config.kitchen_images || config.kitchen_img || [];
    if (!Array.isArray(kitchenUrl)) kitchenUrl = [kitchenUrl];
    kitchenUrl = kitchenUrl.filter(u => u && u.startsWith('cloud://'));
    list.push({ id: 'global_kitchen', name: '共享厨房', type: 'global_area', folder: '共享厨房', key: 'kitchen_images', currentUrl: kitchenUrl[0] || '' });

    // 3. 休闲公区
    let publicUrl = config.public_area_images || config.public_area_img || [];
    if (!Array.isArray(publicUrl)) publicUrl = [publicUrl];
    publicUrl = publicUrl.filter(u => u && u.startsWith('cloud://'));
    list.push({ id: 'global_public', name: '休闲公区', type: 'global_area', folder: '休闲公区', key: 'public_area_images', currentUrl: publicUrl[0] || '' });

    // 4. 房间
    rooms.forEach(room => { 
      let roomImgs = room.images || room.cover_image || [];
      if (!Array.isArray(roomImgs)) roomImgs = [roomImgs];
      roomImgs = roomImgs.filter(u => u && u.startsWith('cloud://'));
      
      list.push({ 
          id: room._id, 
          name: room.name, 
          roomId: room.id,
          type: 'room', 
          key: 'images', 
          dbId: room._id, 
          currentUrl: roomImgs[0] || '' 
      }); 
    });
    this.setData({ imageList: list });
  },

  handleUploadImage(e) { 
    const { index } = e.currentTarget.dataset; 
    const item = this.data.imageList[index]; 
    wx.chooseImage({ count: 9, success: (res) => { this.uploadToCloud(res.tempFilePaths, item, index); } }); 
  },

  // ★★★ 图片修复：上传到正确文件夹 ★★★
  uploadToCloud(filePaths, item, index) { 
    wx.showLoading({ title: '上传中...' });

    const uploadTasks = filePaths.map((filePath) => {
        let folderName = '';
        if (item.type === 'room') {
            folderName = `rooms/孟沢洲·${item.roomId}`;
        } else if (item.type === 'global_area') {
            folderName = `rooms/${item.folder}`;
        } else {
            folderName = 'home';
        }

        const ext = filePath.match(/\.[^.]+?$/)[0];
        const fileName = `${Date.now()}_${Math.floor(Math.random()*1000)}${ext}`;
        const cloudPath = `${folderName}/${fileName}`;

        return wx.cloud.uploadFile({ cloudPath, filePath });
    });

    Promise.all(uploadTasks).then(results => { 
      const fileIDs = results.map(res => res.fileID);
      this.updateImageDatabase(fileIDs, item, index); 
    }).catch((err) => {
        console.error("上传失败", err);
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'error' });
    });
  },

  updateImageDatabase(fileIDs, item, index) { 
    let promise;
    const dataToUpdate = { [item.key]: fileIDs }; 

    if (item.type === 'room') {
        promise = db.collection('rooms').doc(item.dbId).update({ data: dataToUpdate });
    } else {
        promise = db.collection('config').where({}).update({ data: dataToUpdate }); 
    }
    
    promise.then(() => { 
      wx.hideLoading(); 
      this.setData({ [`imageList[${index}].currentUrl`]: fileIDs[0] }); 
      wx.showToast({ title: '上传成功' });
    }).catch(err => {
        console.error("数据库更新失败", err);
        wx.hideLoading();
    });
  },

  editPrice(e) { 
    const item = e.currentTarget.dataset.item; 
    this.setData({ 
      editingId: item._id, 
      tempPrices: { day: item.price_day, holiday: item.price_holiday, week: item.price_week, half: item.price_half_month, month: item.price_month } 
    }); 
  },

  handlePriceInput(e) { 
    this.setData({ [`tempPrices.${e.currentTarget.dataset.field}`]: e.detail.value }); 
  },
  
  cancelEdit() {
    this.setData({ editingId: null });
  },

  savePrice(e) { 
    const dbId = e.currentTarget.dataset.dbid; 
    const p = this.data.tempPrices; 
    db.collection('rooms').doc(dbId).update({ 
      data: { price_day: Number(p.day), price_holiday: Number(p.holiday), price_week: Number(p.week), price_half_month: Number(p.half), price_month: Number(p.month) } 
    }).then(() => { 
      wx.showToast({ title: '保存成功' }); 
      this.setData({ editingId: null });
      this.initData(); 
    }); 
  },

  // === 房态管理核心 ===

  switchAdminRoom(e) { 
    this.setData({ currentAdminRoom: e.currentTarget.dataset.id }, () => { this.fetchAdminBookings(); }); 
  },

  // ★★★ 房态修复：恢复了日期范围查询 + 循环分页，解决18号后失效问题 ★★★
  async fetchAdminBookings() { 
    wx.showLoading({ title: '刷新中...', mask: true });

    const d = new Date(this.data.currentDateObj);
    const year = d.getFullYear();
    const month = d.getMonth();

    // 计算本月第一天和最后一天，精确锁定范围
    const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDayObj = new Date(year, month + 1, 0);
    const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${lastDayObj.getDate()}`;

    const MAX_LIMIT = 20; 
    let allData = [];
    let page = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const res = await db.collection('bookings')
          .where({
            roomId: this.data.currentAdminRoom,
            status: 'booked',
            // 关键：增加日期过滤，防止超出100条限制把本月的挤掉
            date: _.gte(startDateStr).and(_.lte(endDateStr))
          })
          .skip(page * MAX_LIMIT)
          .limit(MAX_LIMIT)
          .get();

        const list = res.data;
        allData = allData.concat(list);

        if (list.length < MAX_LIMIT) {
          hasMore = false;
        } else {
          page++;
        }
      }

      // 去重
      const rawDates = allData.map(item => item.date);
      const bookedDates = [...new Set(rawDates)];

      this.generateAdminCalendar(bookedDates);
      setTimeout(() => { this.updateGridRect(); }, 500);
      wx.hideLoading();
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '加载房态失败', icon: 'none' });
      this.generateAdminCalendar([]); // 失败时至少显示空日历
      wx.hideLoading();
    }
  },

  generateAdminCalendar(bookedDates) { 
    const date = new Date(this.data.currentDateObj); 
    const year = date.getFullYear(); 
    const month = date.getMonth(); 
    this.setData({ monthText: `${year}年${month + 1}月` }); 
    
    const firstDay = new Date(year, month, 1).getDay(); 
    const lastDate = new Date(year, month + 1, 0).getDate(); 
    
    let days = []; 
    for (let i = 0; i < firstDay; i++) { days.push({ day: '', isEmpty: true }); } 
    for (let d = 1; d <= lastDate; d++) { 
      const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; 
      const isBooked = bookedDates.includes(fullDate); 
      days.push({ 
        day: d, 
        fullDate: fullDate, 
        isBooked: isBooked, 
        originalBooked: isBooked,
        isEmpty: false 
      }); 
    } 
    this.setData({ adminCalendarDays: days }); 
  },

  prevMonth() { 
    let d = new Date(this.data.currentDateObj); 
    d.setMonth(d.getMonth() - 1); 
    d.setDate(1);
    this.setData({ currentDateObj: d.getTime() }, () => { this.fetchAdminBookings(); }); 
  },

  nextMonth() { 
    let d = new Date(this.data.currentDateObj); 
    d.setMonth(d.getMonth() + 1); 
    d.setDate(1); 
    this.setData({ currentDateObj: d.getTime() }, () => { this.fetchAdminBookings(); }); 
  },

  updateGridRect() { 
    if (!this.data.sectionExpanded.calendar) return; 
    wx.createSelectorQuery().select('.days-grid').boundingClientRect(rect => { 
      if (rect) this.setData({ gridRect: rect }); 
    }).exec(); 
  },

  calcIndexFromTouch(touch) { 
    const { gridRect, adminCalendarDays } = this.data; 
    if (!gridRect) return -1; 
    const x = touch.clientX - gridRect.left; 
    const y = touch.clientY - gridRect.top; 
    const colWidth = gridRect.width / 7; 
    const rowCount = Math.ceil(adminCalendarDays.length / 7); 
    const rowHeight = gridRect.height / rowCount; 
    const col = Math.floor(x / colWidth); 
    const row = Math.floor(y / rowHeight); 
    if (col < 0 || col >= 7 || row < 0 || row >= rowCount) return -1; 
    return row * 7 + col; 
  },

  handleGridTouchStart(e) { 
    if (!this.data.gridRect) this.updateGridRect(); 
    const startIndex = this.calcIndexFromTouch(e.touches[0]); 
    if (startIndex === -1) return; 
    const day = this.data.adminCalendarDays[startIndex]; 
    if (!day || day.isEmpty) return; 
    this.setData({ isDragging: false, dragStartIndex: startIndex, dragEndIndex: startIndex, dragTargetStatus: !day.isBooked }); 
  },

  handleGridTouchMove(e) { 
    const currentIndex = this.calcIndexFromTouch(e.touches[0]); 
    if (currentIndex === -1) return; 
    if (currentIndex !== this.data.dragStartIndex) this.setData({ isDragging: true });
    if (this.data.isDragging && currentIndex !== this.data.dragEndIndex) {
        this.setData({ dragEndIndex: currentIndex }); 
        this.updateBatchVisuals(this.data.dragStartIndex, currentIndex, this.data.dragTargetStatus); 
    }
  },

  handleGridTouchEnd() { 
    const { isDragging, dragStartIndex, dragEndIndex, dragTargetStatus, adminCalendarDays } = this.data; 
    if (!isDragging) return;
    const start = Math.min(dragStartIndex, dragEndIndex); 
    const end = Math.max(dragStartIndex, dragEndIndex); 
    const targetDates = []; 
    for (let i = start; i <= end; i++) { 
      const item = adminCalendarDays[i]; 
      if (item && !item.isEmpty && item.originalBooked !== dragTargetStatus) targetDates.push(item.fullDate); 
    } 
    this.setData({ isDragging: false, dragStartIndex: -1, dragEndIndex: -1 }); 
    if (targetDates.length > 0) { 
      if (dragTargetStatus) this.batchLockDates(targetDates); 
      else this.batchUnlockDates(targetDates); 
    } else { 
      this.fetchAdminBookings();
    } 
  },

  toggleDayStatus(e) {
    if (this.data.isDragging) return;
    const index = e.currentTarget.dataset.index;
    const item = this.data.adminCalendarDays[index];
    if(!item || item.isEmpty) return;
    const isBooked = !item.isBooked; 
    this.setData({ [`adminCalendarDays[${index}].isBooked`]: isBooked });
    if(isBooked) this.batchLockDates([item.fullDate]);
    else this.batchUnlockDates([item.fullDate]);
  },

  updateBatchVisuals(startIdx, endIdx, status) { 
    const start = Math.min(startIdx, endIdx); 
    const end = Math.max(startIdx, endIdx); 
    const newDays = this.data.adminCalendarDays.map(d => {
      d.isBooked = d.originalBooked;
      return d;
    }); 
    for (let i = start; i <= end; i++) { 
      if (newDays[i] && !newDays[i].isEmpty) newDays[i].isBooked = status; 
    } 
    this.setData({ adminCalendarDays: newDays }); 
  },

  // === 调用云函数 ===

  batchLockDates(dates) { 
    wx.showLoading({ title: '处理中...', mask: true }); 
    wx.cloud.callFunction({
      name: 'manageBookings',
      data: { action: 'lock', roomId: this.data.currentAdminRoom, dates: dates }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.success) {
        wx.showToast({ title: '设置成功' });
      } else {
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
      this.fetchAdminBookings();
    }).catch(err => {
      console.error(err);
      wx.hideLoading();
      this.fetchAdminBookings();
    });
  },

  batchUnlockDates(dates) { 
    wx.showLoading({ title: '处理中...', mask: true }); 
    wx.cloud.callFunction({
      name: 'manageBookings',
      data: { action: 'unlock', roomId: this.data.currentAdminRoom, dates: dates }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.success) {
        wx.showToast({ title: '设置成功' });
      }
      this.fetchAdminBookings();
    }).catch(err => {
      console.error(err);
      wx.hideLoading();
      this.fetchAdminBookings();
    });
  }
});