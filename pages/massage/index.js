const db = wx.cloud.database();

// === 配置管理员权限 ===
// 获取 OpenID 方法：
// 1. 运行小程序，确保在“我的”页面已登录
// 2. 这里的 onLoad 会自动在控制台(Console)打印出你的 OpenID
// 3. 将打印出的 ID 复制替换下面的字符串
const ADMIN_IDS = [
  'OpenID: oDwJG1yI3Poum-CHoryAeqtPETu0', 
];

Page({
  data: {
    navHeight: 0,
    activeTab: 0,
    tabs: ['老板推荐', '客人分享'],
    posts: [],
    loading: false,
    // [新增] 用于控制删除按钮显示
    openid: '',
    isAdmin: false
  },

  onLoad() {
    // 1. 计算顶部安全高度
    const sys = wx.getSystemInfoSync();
    
    // 2. [新增] 获取用户信息并判断权限
    const openid = wx.getStorageSync('openid');

    // === 调试辅助代码：打印 OpenID ===
    if (openid) {
      console.log('==================================================');
      console.log('【请复制此ID到 ADMIN_IDS 数组中】当前用户的 OpenID:', openid);
      console.log('==================================================');
    } else {
      console.log('【提示】当前未检测到 OpenID，请先去“我的”页面登录');
    }

    const isAdmin = ADMIN_IDS.includes(openid);

    this.setData({
      navHeight: sys.statusBarHeight + 44,
      openid: openid || '',
      isAdmin: isAdmin
    });

    this.fetchPosts();
  },

  // 切换 Tab
  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeTab: index
    }, () => {
      this.fetchPosts();
    });
  },

  // 获取数据
  fetchPosts() {
    this.setData({
      loading: true
    });
    db.collection('posts')
      .where({
        type: this.data.activeTab
      })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        this.setData({
          posts: res.data,
          loading: false
        });
      })
      .catch(err => {
        console.error("加载失败", err);
        this.setData({
          loading: false
        });
      });
  },

  // --- [新增] 删除功能 ---
  handleDelete(e) {
    const { id, index } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '提示',
      content: '确定要删除这条分享吗？此操作无法恢复。',
      confirmColor: '#ff4d4f', // 确认按钮显示红色警示
      success: (res) => {
        if (res.confirm) {
          this.deletePost(id, index);
        }
      }
    });
  },

  deletePost(id, index) {
    wx.showLoading({
      title: '删除中...'
    });

    // 调用云数据库删除
    // 注意：如果是管理员删除非自己发布的帖子，需要在云数据库的“权限设置”中配置规则，
    // 或者使用云函数进行删除（如果不修改数据库权限，普通客户端删除只能删除自己创建的数据）
    db.collection('posts').doc(id).remove()
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: '已删除'
        });

        // 本地移除该条数据，避免重新刷新页面
        const newPosts = [...this.data.posts];
        newPosts.splice(index, 1);
        this.setData({
          posts: newPosts
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('删除失败', err);
        wx.showToast({
          title: '删除失败，无权限或网络错误',
          icon: 'none'
        });
      });
  },

  // --- 底部导航跳转逻辑 ---
  navToHome() {
    wx.reLaunch({
      url: '/pages/home/index'
    });
  },

  navToNotes() {
    wx.reLaunch({
      url: '/pages/notes/index'
    });
  },

  navToMassage() {
    // 当前就在一起分享页面，保持不动
  },

  navToMy() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  },

  // --- 发帖逻辑 ---
  handlePublish() {
    // 1. 验证登录 (仅针对客人分享栏 activeTab === 1)
    if (this.data.activeTab === 1) {
      const openid = wx.getStorageSync('openid');
      if (!openid) {
        wx.showModal({
          title: '提示',
          content: '请先前往“我的”页面登录后分享',
          showCancel: false,
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              this.navToMy(); // 跳转到登录页
            }
          }
        });
        return;
      }
    }

    // 2. 选择图片 (最多9张)
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      success: (res) => {
        const tempFilePaths = res.tempFiles.map(file => file.tempFilePath);
        this.showPublishModal(tempFilePaths);
      }
    });
  },

  showPublishModal(imagePaths) {
    wx.showModal({
      title: '分享瞬间',
      editable: true,
      placeholderText: '此刻的想法...',
      success: async (res) => {
        if (res.confirm && res.content) {
          const content = res.content;

          wx.showLoading({
            title: '发布中...'
          });
          // 默认传 false (非匿名)
          this.uploadAndSave(content, imagePaths, false);
        }
      }
    });
  },

  // 支持多图上传
  uploadAndSave(content, tempPaths, isAnonymous) {
    const uploadTasks = tempPaths.map((path, index) => {
      const cloudPath = `posts/${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}.jpg`;
      return wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: path
      });
    });

    Promise.all(uploadTasks).then(results => {
      const fileIDs = results.map(res => res.fileID);

      // 确定显示名称
      let finalUserName = "房客";
      if (this.data.activeTab === 0) {
        finalUserName = "孟沢洲主理人";
      } else {
        finalUserName = "认证房客";
      }

      db.collection('posts').add({
        data: {
          type: this.data.activeTab,
          userName: finalUserName,
          avatar: "",
          content: content,
          images: fileIDs, // 存入图片数组
          comments: [], // 初始化评论数组
          createTime: db.serverDate()
        },
        success: () => {
          wx.hideLoading();
          wx.showToast({
            title: '发布成功'
          });
          this.fetchPosts();
        },
        fail: (e) => {
          wx.hideLoading();
          console.error(e);
        }
      });
    }).catch(e => {
      wx.hideLoading();
      console.error("上传图片失败", e);
      wx.showToast({
        title: '图片上传失败',
        icon: 'none'
      });
    });
  },

  // --- 图片预览 (点击放大、滑动) ---
  previewImage(e) {
    const {
      current,
      urls
    } = e.currentTarget.dataset;
    wx.previewImage({
      current: current, // 当前显示图片的链接
      urls: urls // 需要预览的图片链接列表
    });
  },

  // --- 评论功能 ---
  handleComment(e) {
    // 如果是客人分享栏，同样需要登录验证
    const openid = wx.getStorageSync('openid');
    if (!openid && this.data.activeTab === 1) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    const {
      id,
      index,
      replyto
    } = e.currentTarget.dataset;
    
    wx.showModal({
      title: replyto ? `回复: ${replyto}` : '评论',
      editable: true,
      placeholderText: '写下你的评论...',
      success: (res) => {
        if (res.confirm && res.content) {
          this.submitComment(id, index, res.content, replyto);
        }
      }
    });
  },

  submitComment(postId, index, content, replyTo) {
    wx.showLoading({
      title: '提交中'
    });
    
    // 确定评论者名字
    let commentUser = "房客";
    if (this.data.activeTab === 0) {
       // 如果是老板页面，老板回复显示主理人，其他人显示房客
       // 这里简单逻辑处理
       commentUser = "访客"; 
    } else {
       commentUser = "认证房客"; 
    }

    const newComment = {
      user: commentUser,
      content: content,
      replyTo: replyTo || null,
      time: new Date().getTime()
    };

    // 使用云开发 command 更新数组
    const _ = db.command;
    db.collection('posts').doc(postId).update({
      data: {
        comments: _.push(newComment)
      }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '评论成功'
      });
      // 局部刷新页面数据，避免重新加载整个列表
      const key = `posts[${index}].comments`;
      const currentComments = this.data.posts[index].comments || [];
      this.setData({
        [key]: [...currentComments, newComment]
      });
    }).catch(err => {
      wx.hideLoading();
      console.error(err);
      wx.showToast({
        title: '评论失败',
        icon: 'none'
      });
    });
  }
});