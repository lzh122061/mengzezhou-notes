const db = wx.cloud.database();

// 管理员 OpenID 列表
const ADMIN_IDS = [
  'oDwJG1yI3Poum-CHoryAeqtPETu0', 
];

Page({
  data: {
    navHeight: 0,
    activeTab: 0,
    tabs: ['特别推荐', '客人分享'],
    posts: [],
    loading: false,
    openid: '',
    isAdmin: false,
    showDetail: false,
    selectedPost: {},
    selectedIndex: -1,
    
    // --- 详情页评论交互相关数据 ---
    commentInputValue: '',
    commentPlaceholder: '说点什么...',
    commentInputFocus: false,
    replyToUser: null,

    // --- 发布流程相关数据 ---
    showPublishDrawer: false,
    publishContent: '',
    tempPublishImages: []
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const openid = wx.getStorageSync('openid');
    const isAdmin = ADMIN_IDS.includes(openid);
    
    // 计算导航栏高度：状态栏高度 + 44px（胶囊区域大致高度）
    this.setData({
      navHeight: sys.statusBarHeight + 44,
      openid: openid || '',
      isAdmin: isAdmin
    });
    this.fetchPosts();
  },

  // --- 自定义发布界面逻辑 ---

  handlePublish() {
    // 权限检查：如果是客人分享且未登录
    if (this.data.activeTab === 1 && !this.data.openid) {
      wx.showModal({
        title: '提示', 
        content: '请先登录', 
        showCancel: false,
        success: (res) => { if (res.confirm) this.navToMy(); }
      });
      return;
    }

    // 点击发布按钮后直接打开编辑界面
    this.setData({
      showPublishDrawer: true,
      publishContent: '',
      tempPublishImages: []
    });
  },

  // 在发布界面内点击添加照片
  onAddImage() {
    const currentCount = this.data.tempPublishImages.length;
    if (currentCount >= 9) {
      wx.showToast({ title: '最多上传9张照片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: 9 - currentCount,
      mediaType: ['image'],
      success: (res) => {
        const newPaths = res.tempFiles.map(file => file.tempFilePath);
        this.setData({
          tempPublishImages: [...this.data.tempPublishImages, ...newPaths]
        });
      }
    });
  },

  // 删除选中的待发布照片
  onDeleteImage(e) {
    const { index } = e.currentTarget.dataset;
    let { tempPublishImages } = this.data;
    tempPublishImages.splice(index, 1);
    this.setData({
      tempPublishImages: tempPublishImages
    });
  },

  onPublishInput(e) {
    this.setData({ publishContent: e.detail.value });
  },

  closePublishDrawer() {
    this.setData({ 
      showPublishDrawer: false,
      tempPublishImages: [],
      publishContent: ''
    });
  },

  // 执行最终发布
  confirmPublish() {
    const { publishContent, tempPublishImages } = this.data;
    
    if (!publishContent.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '发布中...' });
    this.uploadAndSave(publishContent, tempPublishImages);
  },

  uploadAndSave(content, tempPaths) {
    // 如果没有选择图片，直接保存文字
    if (tempPaths.length === 0) {
      this.saveToDatabase(content, []);
      return;
    }

    // 批量上传图片
    const tasks = tempPaths.map((path, i) => {
      return wx.cloud.uploadFile({
        cloudPath: `posts/${Date.now()}-${i}.jpg`,
        filePath: path
      });
    });

    Promise.all(tasks).then(results => {
      const fileIDs = results.map(res => res.fileID);
      this.saveToDatabase(content, fileIDs);
    }).catch(err => {
      console.error(err);
      wx.hideLoading();
      wx.showToast({ title: '图片上传失败', icon: 'none' });
    });
  },

  saveToDatabase(content, fileIDs) {
    // 发布人身份逻辑
    let name = "认证房客";
    if (this.data.isAdmin) {
      name = "刘不行";
    } else {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo && userInfo.nickName) {
        name = userInfo.nickName;
      }
    }

    // 保存到数据库
    db.collection('posts').add({
      data: {
        type: this.data.activeTab, 
        userName: name, 
        content, 
        images: fileIDs,
        comments: [], 
        createTime: db.serverDate()
      },
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '发布成功' });
        this.closePublishDrawer();
        this.fetchPosts(); // 刷新列表
      },
      fail: (err) => {
        console.error(err);
        wx.hideLoading();
        wx.showToast({ title: '发布失败', icon: 'none' });
      }
    });
  },

  // --- 详情层逻辑 ---

  showPostDetail(e) {
    const { index } = e.currentTarget.dataset;
    const post = this.data.posts[index];
    if (!post) return;

    const formatTime = (timeData) => {
      if (!timeData) return "";
      let date = timeData instanceof Date ? timeData : new Date(timeData);
      if (isNaN(date.getTime())) return "";
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const d = date.getDate();
      return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
    };

    post.displayTime = formatTime(post.createTime);

    this.setData({
      showDetail: true,
      selectedPost: post,
      selectedIndex: index,
      commentInputValue: '',
      commentPlaceholder: '说点什么...',
      replyToUser: null
    });
  },

  closePostDetail() {
    this.setData({
      showDetail: false,
      selectedPost: {},
      selectedIndex: -1
    });
  },

  onCommentInput(e) {
    this.setData({ commentInputValue: e.detail.value });
  },

  tapReplyComment(e) {
    const { user } = e.currentTarget.dataset;
    this.setData({
      replyToUser: user,
      commentPlaceholder: `回复 @${user}`,
      commentInputFocus: true
    });
  },

  onCommentBlur() {
    if (!this.data.commentInputValue) {
      this.setData({
        commentPlaceholder: '说点什么...',
        replyToUser: null
      });
    }
  },

  submitDetailComment() {
    const { commentInputValue, selectedPost, selectedIndex, replyToUser, openid, isAdmin } = this.data;
    if (!commentInputValue.trim()) return;
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '发送中' });
    
    let userName = "认证房客";
    if (isAdmin) {
      userName = "刘不行";
    } else {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo && userInfo.nickName) {
        userName = userInfo.nickName;
      }
    }

    const newComment = {
      userName,
      content: commentInputValue,
      replyTo: replyToUser || null,
      time: Date.now()
    };

    db.collection('posts').doc(selectedPost._id).update({
      data: {
        comments: db.command.push(newComment)
      }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '评论成功' });

      const updatedComments = [...(selectedPost.comments || []), newComment];
      const postKey = `posts[${selectedIndex}].comments`;
      
      this.setData({
        [postKey]: updatedComments,
        'selectedPost.comments': updatedComments,
        commentInputValue: '',
        commentPlaceholder: '说点什么...',
        replyToUser: null
      });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '提交失败', icon: 'none' });
    });
  },

  // --- 基础页面逻辑 ---

  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeTab: index }, () => { this.fetchPosts(); });
  },

  fetchPosts() {
    this.setData({ loading: true });
    db.collection('posts')
      .where({ type: this.data.activeTab })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        this.setData({ posts: res.data, loading: false });
      })
      .catch(() => {
        this.setData({ loading: false });
      });
  },

  handleDelete(e) {
    const { id, index } = e.currentTarget.dataset;
    wx.showModal({
      title: '提示',
      content: '确定要删除这条分享吗？',
      confirmColor: '#ff4d4f',
      success: (res) => { if (res.confirm) this.deletePost(id, index); }
    });
  },

  deletePost(id, index) {
    wx.showLoading({ title: '删除中...' });
    
    wx.cloud.callFunction({
      name: 'deletePost',
      data: { id: id }
    })
    .then((res) => {
      if (res.result && res.result.stats && res.result.stats.removed > 0) {
        wx.hideLoading();
        wx.showToast({ title: '已删除' });
        
        const newPosts = [...this.data.posts];
        newPosts.splice(index, 1);
        this.setData({ posts: newPosts });
      } else {
        throw new Error('Record not found');
      }
    })
    .catch((err) => {
      console.error(err);
      wx.hideLoading();
      setTimeout(() => {
        wx.showToast({
          title: '删除失败',
          icon: 'error',
          duration: 1000
        });
      }, 2000);
    });
  },

  handleComment(e) {
    const { id, index } = e.currentTarget.dataset;
    wx.showModal({
      title: '发表评论', 
      editable: true,
      success: (res) => {
        if (res.confirm && res.content) {
          this.submitComment(id, index, res.content);
        }
      }
    });
  },

  submitComment(postId, index, content) {
    wx.showLoading({ title: '提交中' });
    
    let user = "认证房客";
    if (this.data.isAdmin) {
      user = "刘不行";
    } else {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo && userInfo.nickName) {
        user = userInfo.nickName;
      }
    }

    const newComment = { userName: user, content, replyTo: null, time: Date.now() };
    db.collection('posts').doc(postId).update({
      data: { comments: db.command.push(newComment) }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '评论成功' });
      const key = `posts[${index}].comments`;
      this.setData({ [key]: [...(this.data.posts[index].comments || []), newComment] });
    }).catch(err => {
      console.error(err);
      wx.hideLoading();
    });
  },

  navToHome() { wx.reLaunch({ url: '/pages/home/index' }); },
  navToNotes() { wx.reLaunch({ url: '/pages/notes/index' }); },
  navToMy() { wx.reLaunch({ url: '/pages/index/index' }); }
});