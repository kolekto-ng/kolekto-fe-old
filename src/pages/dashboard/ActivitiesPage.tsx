import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActivities } from '@/store/useDashboard';
import {
  AlertTriangle,
  ArrowDownLeft,
  Bell,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  Clock,
  Info,
  ListFilter,
  Search,
  Users,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';
import { ActivityListSkeleton } from '@/components/ui/page-skeletons';
import { useAuthStore } from '@/store/useAuthStore';
import {
  getNotificationUserId,
  markContributorsSeen,
} from '@/utils/contributorNotifications';
import { useNotifications } from '@/store/useNotifications';
import { resolveNotificationTarget } from '@/utils/notificationTarget';

function relativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    if (diffMs < 0) return 'just now';

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

    const weeks = Math.floor(days / 7);
    if (weeks <= 57) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;

    return '57 weeks ago';
  } catch {
    return '';
  }
}

function formatCurrency(amount: number) {
  return `\u20A6${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Maps the unified activity row from /dashboard/activities to the
// icon/label/colour shape the list renderer uses. Withdrawal `type`
// values (`withdrawal_requested`, `withdrawal_approved`,
// `withdrawal_rejected`, `withdrawal_pending`) come from the BE based on
// the withdrawals.status column — see kolekto-be-old controllers/dashboard.js
// withdrawalStatusToActivityType.
function getActivityMeta(activity: any) {
  const type = activity.type || (activity.status === 'paid' ? 'contribution' : 'contribution');

  if (type === 'withdrawal_requested' || type === 'withdrawal_pending') {
    return {
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      iconBg: 'bg-amber-50 border border-amber-200',
      title: 'Withdrawal Requested',
      amountColor: 'text-amber-700',
      amountPrefix: '-',
      statusLabel: 'Pending admin approval',
    };
  }
  if (type === 'withdrawal_approved' || type === 'withdrawal_completed') {
    return {
      icon: <CheckCircle2 className="w-5 h-5 text-green-700" />,
      iconBg: 'bg-green-50 border border-green-200',
      title: 'Withdrawal Approved',
      amountColor: 'text-green-700',
      amountPrefix: '-',
      statusLabel: 'Paid out',
    };
  }
  if (type === 'withdrawal_rejected') {
    return {
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      iconBg: 'bg-red-50 border border-red-200',
      title: 'Withdrawal Declined',
      amountColor: 'text-red-500',
      amountPrefix: '-',
      statusLabel: 'Funds returned to wallet',
    };
  }
  return {
    icon: <ArrowDownLeft className="w-5 h-5 text-green-700" />,
    iconBg: 'bg-green-50 border border-green-200',
    title: activity.name || 'Contribution',
    amountColor: 'text-green-700',
    amountPrefix: '+',
    statusLabel: null as string | null,
  };
}

// In-app notifications carry a free-form `data.type` tone (success/info/
// warning/error) set by the backend (see kolekto-be-old/utils/pushNotifications.js).
function getNotificationMeta(notification: any) {
  const tone = String(notification?.data?.type || 'info');
  if (tone === 'success') {
    return { icon: <CheckCircle2 className="w-5 h-5 text-emerald-700" />, iconBg: 'bg-emerald-50 border border-emerald-200' };
  }
  if (tone === 'warning') {
    return { icon: <AlertTriangle className="w-5 h-5 text-amber-600" />, iconBg: 'bg-amber-50 border border-amber-200' };
  }
  if (tone === 'error') {
    return { icon: <XCircle className="w-5 h-5 text-red-500" />, iconBg: 'bg-red-50 border border-red-200' };
  }
  return { icon: <Info className="w-5 h-5 text-blue-600" />, iconBg: 'bg-blue-50 border border-blue-200' };
}

type Tab = 'all' | 'contributions' | 'wallet' | 'notifications';

const ActivitiesPage: React.FC = () => {
  const { activities, isLoading, getActivities } = useActivities() as any;
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const user = useAuthStore((state: any) => state.user);
  const notificationUserId = getNotificationUserId(user);
  // The `notifications` table is keyed by the real auth user id — unlike
  // notificationUserId (used only for the contributor-activity "seen" marker
  // above), this must never fall back to email.
  const userId: string | null = user?.id || user?.user?.id || null;

  // The BE merges contributions + withdrawals into one sorted feed under
  // /dashboard/activities. Previously this page queried Supabase
  // contributions directly, which silently dropped withdrawal activity
  // — the user couldn't see their pending/approved/rejected withdrawals.
  useEffect(() => {
    getActivities();
  }, [getActivities]);

  useEffect(() => {
    if (!notificationUserId || isLoading) return;
    markContributorsSeen(notificationUserId);
  }, [activities, isLoading, notificationUserId]);

  // Same in-app notification feed the navbar bell badges — pushed approvals,
  // status changes, payment receipts, etc. The bell now just deep-links to
  // this page (no tab state); notifications are merged into the "All"
  // feed below, with their own tab still available as a pure filter.
  const notifications = useNotifications((s) => s.notifications);
  const notificationsLoading = useNotifications((s) => s.isLoading);
  const fetchNotifications = useNotifications((s) => s.fetchNotifications);
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const subscribe = useNotifications((s) => s.subscribe);
  const unsubscribe = useNotifications((s) => s.unsubscribe);
  const unreadNotifications = useNotifications((s) => s.unreadCount);

  useEffect(() => {
    if (!userId) return;
    void fetchNotifications(userId);
    subscribe(userId);
    return () => unsubscribe();
  }, [userId, fetchNotifications, subscribe, unsubscribe]);

  const handleNotificationClick = (notification: any) => {
    if (!notification.read_at) void markRead(notification.id);
    const { path, external } = resolveNotificationTarget(notification.url);
    if (path) navigate(path);
    else if (external) window.location.href = external;
  };

  // Unified feed card shape — activities (contributions/withdrawals) and
  // in-app notifications are mapped to the same shape so the "All" tab can
  // render them merged and sorted by time, per the requirement that
  // notifications show up inside All Activities rather than only their own
  // tab.
  const activityFeedCards = useMemo(() => {
    const rows = Array.isArray(activities) ? activities : [];
    return rows.map((activity: any) => {
      const collectionName = activity.collection_title || activity.collection?.title || '';
      const meta = getActivityMeta(activity);
      const isWithdrawal = activity.category === 'wallet';
      const primaryLabel = isWithdrawal ? meta.title : (activity.name || 'Anonymous Contributor');
      const amount = Number(activity.amount || 0);
      const isContribution = meta.amountPrefix === '+';

      return {
        id: `activity-${activity.id}`,
        kind: 'activity' as const,
        category: isWithdrawal ? 'wallet' : ('contribution' as const),
        icon: meta.icon,
        iconBg: meta.iconBg,
        title: primaryLabel,
        subtitle: collectionName,
        timeMs: activity.created_at ? new Date(activity.created_at).getTime() : 0,
        timeLabel: activity.created_at ? relativeTime(activity.created_at) : '',
        amountLabel: `${meta.amountPrefix}${formatCurrency(amount)}`,
        amountColor: meta.amountColor,
        badgeLabel: isContribution ? 'Contribution' : meta.statusLabel,
        badgeClass: isContribution
          ? 'bg-emerald-50 text-emerald-700'
          : meta.amountColor === 'text-red-500'
            ? 'bg-red-50 text-red-600'
            : 'bg-blue-50 text-blue-700',
        unread: false,
        raw: activity,
        searchText: [primaryLabel, collectionName, meta.title, meta.statusLabel, formatCurrency(amount)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      };
    });
  }, [activities]);

  const notificationFeedCards = useMemo(() => {
    const rows = Array.isArray(notifications) ? notifications : [];
    return rows.map((notification: any) => {
      const meta = getNotificationMeta(notification);
      const unread = !notification.read_at;

      return {
        id: `notification-${notification.id}`,
        kind: 'notification' as const,
        category: 'notification' as const,
        icon: meta.icon,
        iconBg: meta.iconBg,
        title: notification.title,
        subtitle: notification.body,
        timeMs: notification.created_at ? new Date(notification.created_at).getTime() : 0,
        timeLabel: notification.created_at ? relativeTime(notification.created_at) : '',
        amountLabel: null as string | null,
        amountColor: '',
        badgeLabel: unread ? 'New' : null,
        badgeClass: 'bg-emerald-50 text-emerald-700',
        unread,
        raw: notification,
        searchText: [notification.title, notification.body].filter(Boolean).join(' ').toLowerCase(),
      };
    });
  }, [notifications]);

  const { filteredCards, walletCount, contribCount, totalCount, notificationCount } = useMemo(() => {
    const walletCards = activityFeedCards.filter((card) => card.category === 'wallet');
    const contributionCards = activityFeedCards.filter((card) => card.category !== 'wallet');
    const allCards = [...activityFeedCards, ...notificationFeedCards].sort((a, b) => b.timeMs - a.timeMs);
    const notificationCards = [...notificationFeedCards].sort((a, b) => b.timeMs - a.timeMs);

    const byTab =
      tab === 'all'
        ? allCards
        : tab === 'contributions'
          ? contributionCards
          : tab === 'wallet'
            ? walletCards
            : notificationCards;

    return {
      filteredCards: byTab,
      walletCount: walletCards.length,
      contribCount: contributionCards.length,
      totalCount: allCards.length,
      notificationCount: notificationCards.length,
    };
  }, [activityFeedCards, notificationFeedCards, tab]);

  const visibleCards = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return filteredCards;
    return filteredCards.filter((card) => card.searchText.includes(query));
  }, [filteredCards, searchTerm]);

  const isInitialLoading =
    tab === 'wallet' || tab === 'contributions'
      ? isLoading && activityFeedCards.length === 0
      : tab === 'notifications'
        ? notificationsLoading && notificationFeedCards.length === 0
        : (isLoading || notificationsLoading) && filteredCards.length === 0;

  const handleCardClick = (card: (typeof visibleCards)[number]) => {
    if (card.kind === 'notification') handleNotificationClick(card.raw);
  };

  const StatTab = ({
    id,
    label,
    count,
    icon: Icon,
  }: {
    id: Tab;
    label: string;
    count: number;
    icon: React.ElementType;
  }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`group min-w-0 rounded-3xl p-3 text-left transition-all duration-200 sm:p-4 ${
        tab === id
          ? 'bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-100'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
      }`}
    >
      <span
        className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full transition ${
          tab === id ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex min-h-[2rem] items-start break-words text-xs font-semibold leading-tight sm:min-h-[1.25rem] sm:text-sm">
        {label}
      </span>
      <span className="mt-1 block text-2xl font-semibold leading-none tracking-normal text-gray-950 sm:text-3xl">
        {count}
      </span>
    </button>
  );

  return (
    <div className="space-y-5 pb-6">
      <section className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.07)]">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Activity Center</p>
            <h1 className="mt-2 text-3xl font-semibold leading-none tracking-normal text-gray-950 min-[380px]:text-4xl sm:text-5xl">
              Activities
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-600 sm:text-base">
              Contributions you've received and withdrawals you've requested.
            </p>
          </div>
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center min-[380px]:h-28 min-[380px]:w-28 sm:h-36 sm:w-36">
            <div className="absolute inset-3 rounded-full bg-emerald-50 blur-xl" />
            <img
              src="/activity-wallet.png"
              alt="Wallet activity illustration"
              className="relative h-full w-full object-contain"
              loading="eager"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-100 bg-white p-2 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          <StatTab id="all" label="All" count={totalCount} icon={ListFilter} />
          <StatTab id="contributions" label="Contributions" count={contribCount} icon={Users} />
          <StatTab id="wallet" label="Wallet" count={walletCount} icon={WalletCards} />
          <StatTab id="notifications" label="Notifications" count={notificationCount} icon={Bell} />
        </div>
      </section>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search activities..."
          className="h-14 w-full rounded-2xl border border-gray-100 bg-white pl-12 pr-12 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
            aria-label="Clear activity search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {(tab === 'all' || tab === 'notifications') && unreadNotifications > 0 && userId && (
        <div className="flex items-center justify-end px-1">
          <button
            type="button"
            onClick={() => markAllRead(userId)}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        </div>
      )}

      <section className="min-h-[500px] overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.07)]">
        {isInitialLoading ? (
          <div className="p-4 sm:p-5">
            <ActivityListSkeleton count={6} />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCards.length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">No activity in this category yet.</p>
            )}
            {filteredCards.length > 0 && visibleCards.length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">No activities match your search.</p>
            )}
            {visibleCards.map((card) => {
              const Tag = card.kind === 'notification' ? 'button' : 'article';

              return (
                <Tag
                  key={card.id}
                  type={card.kind === 'notification' ? 'button' : undefined}
                  onClick={card.kind === 'notification' ? () => handleCardClick(card) : undefined}
                  className={`grid w-full grid-cols-[3.5rem_1fr] gap-3 px-4 py-4 text-left transition-all duration-200 hover:bg-emerald-50/30 sm:grid-cols-[3.5rem_1fr_auto] sm:px-5 ${
                    card.kind === 'notification' && card.unread ? 'bg-emerald-50/40' : ''
                  }`}
                >
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${card.iconBg}`}>
                    {card.icon}
                  </div>

                  <div className="min-w-0">
                    <h2 className="break-words text-base font-semibold leading-snug text-gray-950 sm:text-lg">
                      {card.title}
                    </h2>
                    {card.subtitle && (
                      <p className="mt-1 break-words text-sm font-medium leading-snug text-gray-600">
                        {card.subtitle}
                      </p>
                    )}
                    <p className="mt-2 flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-500">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span className="break-words">{card.timeLabel}</span>
                    </p>
                  </div>

                  <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-2 sm:col-start-auto sm:flex-col sm:items-end sm:justify-center">
                    {card.amountLabel && (
                      <span className={`break-words text-right text-lg font-semibold leading-tight ${card.amountColor}`}>
                        {card.amountLabel}
                      </span>
                    )}
                    {card.badgeLabel && (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${card.badgeClass}`}>
                        {card.badgeLabel}
                      </span>
                    )}
                  </div>
                </Tag>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default ActivitiesPage;
