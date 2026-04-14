import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
  { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue') },
  { path: '/services', name: 'services', component: () => import('@/views/ServicesView.vue'), meta: { requiresUser: true } },
  { path: '/booking', name: 'booking', component: () => import('@/views/BookingView.vue'), meta: { requiresUser: true } },
  { path: '/history', name: 'history', component: () => import('@/views/HistoryView.vue'), meta: { requiresUser: true } },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { requiresAdmin: true },
    children: [
      { path: '', redirect: '/admin/bookings' },
      { path: 'bookings', name: 'admin-bookings', component: () => import('@/views/admin/AdminBookingView.vue') },
      { path: 'members', name: 'admin-members', component: () => import('@/views/admin/AdminMemberView.vue') },
      { path: 'checkout', name: 'admin-checkout', component: () => import('@/views/admin/AdminCheckoutView.vue') },
      { path: 'finance', name: 'admin-finance', component: () => import('@/views/admin/AdminFinanceView.vue') },
      { path: 'inventory', name: 'admin-inventory', component: () => import('@/views/admin/AdminInventoryView.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/login' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  auth.loadFromStorage();

  if (to.meta.requiresAdmin) {
    if (!auth.adminToken || auth.role !== 'admin') return { name: 'login' };
  }

  if (to.meta.requiresUser) {
    if (!auth.customer?.phone) return { name: 'login' };
  }
});

export default router;
