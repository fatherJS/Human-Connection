<template>
  <div>
    <ds-card v-if="user && user.image">
      <p>PROFILE IMAGE</p>
    </ds-card>
    <ds-space />
    <ds-flex v-if="user" :width="{ base: '100%' }" gutter="base">
      <ds-flex-item :width="{ base: '100%', sm: 2, md: 2, lg: 1 }">
        <ds-card
          :class="{ 'disabled-content': user.disabled }"
          style="position: relative; height: auto;"
        >
          <hc-upload v-if="myProfile" :user="user" />
          <hc-avatar v-else :user="user" class="profile-avatar" size="x-large" />
          <!-- Menu -->
          <no-ssr>
            <content-menu
              placement="bottom-end"
              resource-type="user"
              :resource="user"
              :is-owner="myProfile"
              class="user-content-menu"
            />
          </no-ssr>
          <ds-space margin="small">
            <ds-heading tag="h3" align="center" no-margin>{{ userName }}</ds-heading>
            <ds-text v-if="user.location" align="center" color="soft" size="small">
              <ds-icon name="map-marker" />
              {{ user.location.name }}
            </ds-text>
            <ds-text align="center" color="soft" size="small">
              {{ $t('profile.memberSince') }} {{ user.createdAt | date('MMMM yyyy') }}
            </ds-text>
          </ds-space>
          <ds-space v-if="user.badges && user.badges.length" margin="x-small">
            <hc-badges :badges="user.badges" />
          </ds-space>
          <ds-flex>
            <ds-flex-item>
              <no-ssr>
                <ds-number :label="$t('profile.followers')">
                  <hc-count-to slot="count" :end-val="followedByCount" />
                </ds-number>
              </no-ssr>
            </ds-flex-item>
            <ds-flex-item>
              <no-ssr>
                <ds-number :label="$t('profile.following')">
                  <hc-count-to slot="count" :end-val="Number(user.followingCount) || 0" />
                </ds-number>
              </no-ssr>
            </ds-flex-item>
          </ds-flex>
          <ds-space margin="small">
            <hc-follow-button
              v-if="!myProfile"
              :follow-id="user.id"
              :is-followed="user.followedByCurrentUser"
              @optimistic="follow => (user.followedByCurrentUser = follow)"
              @update="follow => fetchUser()"
            />
          </ds-space>
          <template v-if="user.about">
            <hr />
            <ds-space margin-top="small" margin-bottom="small">
              <ds-text color="soft" size="small">{{ user.about }}</ds-text>
            </ds-space>
          </template>
        </ds-card>
        <ds-space />
        <ds-heading tag="h3" soft style="text-align: center; margin-bottom: 10px;">
          {{ $t('profile.network.title') }}
        </ds-heading>
        <ds-card style="position: relative; height: auto;">
          <ds-space v-if="user.following && user.following.length" margin="x-small">
            <ds-text tag="h5" color="soft">
              {{ userName | truncate(15) }} {{ $t('profile.network.following') }}
            </ds-text>
          </ds-space>
          <template v-if="user.following && user.following.length">
            <ds-space v-for="follow in uniq(user.following)" :key="follow.id" margin="x-small">
              <!-- TODO: find better solution for rendering errors -->
              <no-ssr>
                <user :user="follow" :trunc="15" />
              </no-ssr>
            </ds-space>
            <ds-space v-if="user.followingCount - user.following.length" margin="small">
              <ds-text size="small" color="softer">
                {{ $t('profile.network.and') }} {{ user.followingCount - user.following.length }}
                {{ $t('profile.network.more') }}
              </ds-text>
            </ds-space>
          </template>
          <template v-else>
            <p style="text-align: center; opacity: .5;">
              {{ userName }} {{ $t('profile.network.followingNobody') }}
            </p>
          </template>
        </ds-card>
        <ds-space />
        <ds-card style="position: relative; height: auto;">
          <ds-space v-if="user.followedBy && user.followedBy.length" margin="x-small">
            <ds-text tag="h5" color="soft">
              {{ userName | truncate(15) }} {{ $t('profile.network.followedBy') }}
            </ds-text>
          </ds-space>
          <template v-if="user.followedBy && user.followedBy.length">
            <ds-space v-for="follow in uniq(user.followedBy)" :key="follow.id" margin="x-small">
              <!-- TODO: find better solution for rendering errors -->
              <no-ssr>
                <user :user="follow" :trunc="15" />
              </no-ssr>
            </ds-space>
            <ds-space v-if="user.followedByCount - user.followedBy.length" margin="small">
              <ds-text size="small" color="softer">
                {{ $t('profile.network.and') }} {{ user.followedByCount - user.followedBy.length }}
                {{ $t('profile.network.more') }}
              </ds-text>
            </ds-space>
          </template>
          <template v-else>
            <p style="text-align: center; opacity: .5;">
              {{ userName }} {{ $t('profile.network.followedByNobody') }}
            </p>
          </template>
        </ds-card>
        <ds-space v-if="user.socialMedia && user.socialMedia.length" margin="large">
          <ds-card style="position: relative; height: auto;">
            <ds-space margin="x-small">
              <ds-text tag="h5" color="soft">
                {{ $t('profile.socialMedia') }} {{ user.name | truncate(15) }}?
              </ds-text>
              <template>
                <ds-space v-for="link in socialMediaLinks" :key="link.username" margin="x-small">
                  <a :href="link.url">
                    <ds-avatar :image="link.favicon" />
                    {{ 'link.username' }}
                  </a>
                </ds-space>
              </template>
            </ds-space>
          </ds-card>
        </ds-space>
      </ds-flex-item>

      <ds-flex-item :width="{ base: '100%', sm: 3, md: 5, lg: 3 }">
        <ds-flex class="user-profile-posts-list" :width="{ base: '100%' }" gutter="small">
          <ds-flex-item class="profile-top-navigation">
            <ds-card class="ds-tab-nav">
              <ul class="Tabs">
                <li class="Tabs__tab Tab pointer" :class="{ active: tabActive === 'post' }">
                  <a @click="handleTab('post')">
                    <ds-space margin="small">
                      <no-ssr placeholder="Loading...">
                        <ds-number :label="$t('common.post', null, user.contributionsCount)">
                          <hc-count-to slot="count" :end-val="user.contributionsCount" />
                        </ds-number>
                      </no-ssr>
                    </ds-space>
                  </a>
                </li>
                <li class="Tabs__tab Tab pointer" :class="{ active: tabActive === 'comment' }">
                  <a @click="handleTab('comment')">
                    <ds-space margin="small">
                      <no-ssr placeholder="Loading...">
                        <ds-number :label="$t('profile.commented')">
                          <hc-count-to slot="count" :end-val="user.commentedCount" />
                        </ds-number>
                      </no-ssr>
                    </ds-space>
                  </a>
                </li>
                <li class="Tabs__tab Tab pointer" :class="{ active: tabActive === 'shout' }">
                  <a @click="handleTab('shout')">
                    <ds-space margin="small">
                      <no-ssr placeholder="Loading...">
                        <ds-number :label="$t('profile.shouted')">
                          <hc-count-to slot="count" :end-val="user.shoutedCount" />
                        </ds-number>
                      </no-ssr>
                    </ds-space>
                  </a>
                </li>
                <li class="Tabs__presentation-slider" role="presentation"></li>
              </ul>
            </ds-card>
          </ds-flex-item>

          <ds-flex-item style="text-align: center">
            <ds-button
              v-if="myProfile"
              v-tooltip="{ content: 'Create a new Post', placement: 'left', delay: { show: 500 } }"
              :path="{ name: 'post-create' }"
              class="profile-post-add-button"
              icon="plus"
              size="large"
              primary
            />
          </ds-flex-item>

          <template v-if="activePosts.length">
            <hc-post-card
              v-for="(post, index) in activePosts"
              :key="post.id"
              :post="post"
              :width="{ base: '100%', md: '100%', xl: '50%' }"
              @removePostFromList="activePosts.splice(index, 1)"
            />
          </template>
          <template v-else-if="$apollo.loading">
            <ds-flex-item>
              <ds-section centered>
                <ds-spinner size="base"></ds-spinner>
              </ds-section>
            </ds-flex-item>
          </template>
          <template v-else>
            <ds-flex-item :width="{ base: '100%' }">
              <hc-empty margin="xx-large" icon="file" />
            </ds-flex-item>
          </template>
        </ds-flex>
        <hc-load-more v-if="hasMore" :loading="$apollo.loading" @click="showMoreContributions" />
      </ds-flex-item>
    </ds-flex>
  </div>
</template>

<script>
import uniqBy from 'lodash/uniqBy'
import User from '~/components/User'
import HcPostCard from '~/components/PostCard'
import HcFollowButton from '~/components/FollowButton.vue'
import HcCountTo from '~/components/CountTo.vue'
import HcBadges from '~/components/Badges.vue'
import HcLoadMore from '~/components/LoadMore.vue'
import HcEmpty from '~/components/Empty.vue'
import ContentMenu from '~/components/ContentMenu'
import HcUpload from '~/components/Upload'
import HcAvatar from '~/components/Avatar/Avatar.vue'
import PostQuery from '~/graphql/UserProfile/Post.js'
import UserQuery from '~/graphql/UserProfile/User.js'

const tabToFilterMapping = ({ tab, id }) => {
  return {
    post: { author: { id } },
    comment: { comments_some: { author: { id } } },
    shout: { shoutedBy_some: { id } },
  }[tab]
}

export default {
  name: 'HcUserProfile',
  components: {
    User,
    HcPostCard,
    HcFollowButton,
    HcCountTo,
    HcBadges,
    HcLoadMore,
    HcEmpty,
    HcAvatar,
    ContentMenu,
    HcUpload,
  },
  transition: {
    name: 'slide-up',
    mode: 'out-in',
  },
  data() {
    const filter = tabToFilterMapping({ tab: 'post', id: this.$route.params.id })
    return {
      User: [],
      Post: [],
      activePosts: [],
      voted: false,
      page: 1,
      pageSize: 6,
      tabActive: 'post',
      filter,
    }
  },
  computed: {
    hasMore() {
      const total = {
        post: this.user.contributionsCount,
        shout: this.user.shoutedCount,
        comment: this.user.commentedCount,
      }[this.tabActive]
      return this.Post && this.Post.length < total
    },
    myProfile() {
      return this.$route.params.id === this.$store.getters['auth/user'].id
    },
    followedByCount() {
      let count = Number(this.user.followedByCount) || 0
      return count
    },
    user() {
      return this.User ? this.User[0] : {}
    },
    offset() {
      return (this.page - 1) * this.pageSize
    },
    socialMediaLinks() {
      const { socialMedia = [] } = this.user
      return socialMedia.map(socialMedia => {
        const { url } = socialMedia
        const matches = url.match(/^(?:https?:\/\/)?(?:[^@\n])?(?:www\.)?([^:/\n?]+)/g)
        const [domain] = matches || []
        const favicon = domain ? `${domain}/favicon.ico` : null
        const username = url.split('/').pop()
        return { url, username, favicon }
      })
    },
    userName() {
      const { name } = this.user || {}
      return name || this.$t('profile.userAnonym')
    },
  },
  watch: {
    User(val) {
      if (!val || !val.length) {
        throw new Error('User not found!')
      }
    },
    Post(val) {
      this.activePosts = this.setActivePosts()
    },
  },
  methods: {
    handleTab(tab) {
      this.tabActive = tab
      this.Post = null
      this.filter = tabToFilterMapping({ tab, id: this.$route.params.id })
    },
    uniq(items, field = 'id') {
      return uniqBy(items, field)
    },
    fetchUser() {
      // TODO: we should use subscriptions instead of fetching the whole user again
      this.$apollo.queries.User.refetch()
    },
    showMoreContributions() {
      // this.page++
      // Fetch more data and transform the original result
      this.page++
      this.$apollo.queries.Post.fetchMore({
        variables: {
          filter: this.filter,
          first: this.pageSize,
          offset: this.offset,
        },
        // Transform the previous result with new data
        updateQuery: (previousResult, { fetchMoreResult }) => {
          let output = { Post: this.Post }
          output.Post = [...previousResult.Post, ...fetchMoreResult.Post]
          return output
        },
        fetchPolicy: 'cache-and-network',
      })
    },
    setActivePosts() {
      if (!this.Post) {
        return []
      }
      return this.uniq(this.Post.filter(post => !post.deleted))
    },
  },
  apollo: {
    Post: {
      query() {
        return PostQuery(this.$i18n)
      },
      variables() {
        return {
          filter: this.filter,
          first: this.pageSize,
          offset: 0,
        }
      },
      fetchPolicy: 'cache-and-network',
    },
    User: {
      query() {
        return UserQuery(this.$i18n)
      },
      variables() {
        return { id: this.$route.params.id }
      },
      fetchPolicy: 'cache-and-network',
    },
  },
}
</script>

<style lang="scss">
.pointer {
  cursor: pointer;
}
.Tab {
  border-collapse: collapse;
  padding-bottom: 5px;
}
.Tab:hover {
  border-bottom: 2px solid #c9c6ce;
}
.Tabs {
  position: relative;
  background-color: #fff;
  &:after {
    content: ' ';
    display: table;
    clear: both;
  }
  margin: 0;
  padding: 0;
  list-style: none;
  &__tab {
    float: left;
    width: 33.333%;
    text-align: center;
    &:first-child.active ~ .Tabs__presentation-slider {
      left: 0;
    }
    &:nth-child(2).active ~ .Tabs__presentation-slider {
      left: 33.333%;
    }
    &:nth-child(3).active ~ .Tabs__presentation-slider {
      left: calc(33.333% * 2);
    }
  }
  &__presentation-slider {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 33.333%;
    height: 2px;
    background-color: #17b53f;
    transition: left 0.25s;
  }
}
.profile-avatar.ds-avatar {
  display: block;
  margin: auto;
  margin-top: -60px;
  border: #fff 5px solid;
}
.page-name-profile-id-slug {
  .ds-flex-item:first-child .content-menu {
    position: absolute;
    top: $space-x-small;
    right: $space-x-small;
  }
}
.profile-top-navigation {
  position: sticky;
  top: 53px;
  z-index: 2;
}
.ds-tab-nav {
  .ds-card-content {
    padding: 0 !important;
    .ds-tab-nav-item {
      &.ds-tab-nav-item-active {
        border-bottom: 3px solid #17b53f;
        &:first-child {
          border-bottom-left-radius: $border-radius-x-large;
        }
        &:last-child {
          border-bottom-right-radius: $border-radius-x-large;
        }
      }
    }
  }
}
</style>
