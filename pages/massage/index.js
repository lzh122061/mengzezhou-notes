const db = wx.cloud.database();

// 管理员 OpenID 列表
const ADMIN_IDS = [
  'oDwJG1yI3Poum-CHoryAeqtPETu0',
];

Page({
  data: {
    navHeight: 0,
    posts: [],
    isAdmin: false,
    openid: '',
    loading: false,
    currentTab: 'surrounding',

    showDetail: false,
    selectedPost: null,
    selectedIndex: -1,
    commentInputValue: '',
    commentPlaceholder: '说点什么...',
    commentInputFocus: false,
    replyToUser: null,

    showPublishDrawer: false,
    publishContent: '',
    tempPublishImages: [],

    touchStartX: 0,
    touchStartY: 0,
    isEdgeSwipe: false,

    // --- CDN 优化配置 ---
    cdnOptimizedSuffix: '?imageMogr2/format/webp/quality/70'
  },

  onLoad() {
    this.calculateNavHeight();
    const openid = wx.getStorageSync('openid');
    const isAdmin = ADMIN_IDS.includes(openid);

    this.setData({
      openid: openid || '',
      isAdmin: isAdmin
    });

    this.fetchPosts();
  },

  // 1. 图片处理辅助函数：为普通 URL 增加压缩后缀
  _optimizeUrl(url) {
    if (!url) return '';
    if (url.startsWith('cloud://') || url.startsWith('data:')) return url;
    if (url.indexOf('?') !== -1) return url;
    return url + this.data.cdnOptimizedSuffix;
  },

  fetchPosts() {
    this.setData({ loading: true });
    const { currentTab, openid } = this.data;
    const _ = db.command;

    let queryCondition = { category: currentTab };
    if (currentTab === 'surrounding') {
      queryCondition = _.or([
        { category: 'surrounding' },
        { category: _.exists(false) }
      ]);
    }

    db.collection('posts')
      .where(queryCondition)
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        const posts = res.data.map(item => {
          if (item.images && item.images.length > 0) {
            item.images = item.images.map(imgUrl => this._optimizeUrl(imgUrl));
          }
          return {
            ...item,
            isLiked: (item.likes || []).includes(openid)
          };
        });
        
        this.setData({ posts, loading: false });
      })
      .catch((err) => {
        console.error(err);
        this.setData({ loading: false });
      });
  },

  // 2. 上传优化：在管理员上传前再次进行本地压缩
  onAddImage() {
    const currentCount = this.data.tempPublishImages.length;
    if (currentCount >= 9) {
      wx.showToast({ title: '最多上传9张', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 9 - currentCount,
      mediaType: ['image'],
      sizeType: ['compressed'], 
      success: (res) => {
        // 修复点：定义 tempFiles 变量，从回调结果 res 中获取
        const tempFiles = res.tempFiles;
        
        wx.showLoading({ title: '处理中...', mask: true });

        const compressTasks = tempFiles.map(file => {
          return new Promise((resolve) => {
            wx.compressImage({
              src: file.tempFilePath,
              quality: 70, 
              success: (cRes) => resolve(cRes.tempFilePath),
              fail: () => resolve(file.tempFilePath)
            });
          });
        });

        Promise.all(compressTasks).then(compressedPaths => {
          this.setData({ tempPublishImages: [...this.data.tempPublishImages, ...compressedPaths] });
          wx.hideLoading();
        }).catch(() => wx.hideLoading());
      }
    });
  },

  calculateNavHeight() {
    try {
      const windowInfo = wx.getWindowInfo();
      const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
      const statusBarHeight = windowInfo.statusBarHeight;
      const navHeight = statusBarHeight + menuButtonInfo.height + (menuButtonInfo.top - statusBarHeight) * 2;
      this.setData({ navHeight: navHeight });
    } catch (err) {
      this.setData({ navHeight: 80 });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (this.data.currentTab === tab) return;
    this.setData({
      currentTab: tab,
      posts: []
    }, () => {
      this.fetchPosts();
    });
  },

  onPreviewImage(e) {
    const current = e.currentTarget.dataset.current;
    const urls = e.currentTarget.dataset.urls;
    wx.previewImage({ current, urls });
  },

  onTouchStart(e) {
    if (e.changedTouches.length > 0) {
      const startX = e.changedTouches[0].clientX;
      const startY = e.changedTouches[0].clientY;
      const isEdge = startX < 50;
      this.setData({ touchStartX: startX, touchStartY: startY, isEdgeSwipe: isEdge });
    }
  },

  onTouchEnd(e) {
    if (!this.data.showDetail || !this.data.isEdgeSwipe) return;
    if (e.changedTouches.length > 0) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchEndX - this.data.touchStartX;
      const diffY = touchEndY - this.data.touchStartY;
      if (diffX > 60 && Math.abs(diffY) < 100) {
        this.closePostDetail();
      }
    }
    this.setData({ isEdgeSwipe: false });
  },

  handlePublish() {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '仅管理员可发布', icon: 'none' });
      return;
    }
    this.setData({
      showPublishDrawer: true,
      publishContent: '',
      tempPublishImages: []
    });
  },

  onDeleteImage(e) {
    const { index } = e.currentTarget.dataset;
    let { tempPublishImages } = this.data;
    tempPublishImages.splice(index, 1);
    this.setData({ tempPublishImages });
  },

  onPublishInput(e) {
    this.setData({ publishContent: e.detail.value });
  },

  closePublishDrawer() {
    this.setData({ showPublishDrawer: false, tempPublishImages: [], publishContent: '' });
  },

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
    if (tempPaths.length === 0) {
      this.saveToDatabase(content, []);
      return;
    }
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
    const name = "刘不行";
    const { currentTab } = this.data;
    db.collection('posts').add({
      data: {
        type: 1,
        category: currentTab,
        userName: name,
        content,
        images: fileIDs,
        comments: [],
        likes: [],
        createTime: db.serverDate()
      },
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '发布成功' });
        this.closePublishDrawer();
        this.fetchPosts();
      },
      fail: (err) => {
        console.error(err);
        wx.hideLoading();
        wx.showToast({ title: '发布失败', icon: 'none' });
      }
    });
  },

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
    this.setData({ showDetail: false, selectedPost: null, selectedIndex: -1 });
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
      this.setData({ commentPlaceholder: '说点什么...', replyToUser: null });
    }
  },

  submitDetailComment() {
    const { commentInputValue, selectedPost, selectedIndex, replyToUser, openid, isAdmin } = this.data;
    if (!commentInputValue.trim() || !openid) return;
    wx.showLoading({ title: '发送中' });
    let userName = isAdmin ? "刘不行" : (wx.getStorageSync('userInfo')?.nickName || "认证房客");
    const newComment = { userName, content: commentInputValue, replyTo: replyToUser || null, time: Date.now() };
    db.collection('posts').doc(selectedPost._id).update({
      data: { comments: db.command.push(newComment) }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '评论成功' });
      const updatedComments = [...(selectedPost.comments || []), newComment];
      this.setData({
        [`posts[${selectedIndex}].comments`]: updatedComments,
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
      wx.hideLoading();
      wx.showToast({ title: '删除失败', icon: 'error' });
    });
  },

  handleLike(e) {
    const { id, index } = e.currentTarget.dataset;
    const { openid, posts, selectedPost } = this.data;
    if (!openid) return;
    const isFromDetail = index === 'detail';
    const targetPost = isFromDetail ? selectedPost : posts[index];
    if(!targetPost) return;
    const oldIsLiked = targetPost.isLiked;
    let newLikes = [...(targetPost.likes || [])];
    if (oldIsLiked) {
      newLikes = newLikes.filter(uid => uid !== openid);
    } else {
      newLikes.push(openid);
    }
    const updatedPost = { ...targetPost, isLiked: !oldIsLiked, likes: newLikes };
    if (isFromDetail) {
      this.setData({
        selectedPost: updatedPost,
        [`posts[${this.data.selectedIndex}]`]: updatedPost
      });
    } else {
      this.setData({ [`posts[${index}]`]: updatedPost });
    }
    wx.cloud.callFunction({
      name: 'handleLike',
      data: { postId: id }
    });
  },

  navToHome() { wx.reLaunch({ url: '/pages/home/index' }); },
  navToNotes() { wx.reLaunch({ url: '/pages/notes/index' }); },
  navToMy() { wx.reLaunch({ url: '/pages/index/index' }); },

  onShareAppMessage: function () {
    return {
      title: '孟沢洲的朋友圈',
      path: '/pages/notes/index'
    }
  },

  onShareTimeline: function () {
    return {
      title: '孟沢洲的朋友圈'
    }
  },
});