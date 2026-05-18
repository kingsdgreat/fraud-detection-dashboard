'use client';

import { Settings, Database, Shield, Bell, Users } from 'lucide-react';

export default function ProductionSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          System configuration and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SettingsCard
          icon={Database}
          title="Database"
          description="Connected to Neon PostgreSQL"
          status="Connected"
          statusColor="text-emerald-600 bg-emerald-50"
        />
        <SettingsCard
          icon={Shield}
          title="Authentication"
          description="Credentials provider with JWT sessions"
          status="Active"
          statusColor="text-blue-600 bg-blue-50"
        />
        <SettingsCard
          icon={Bell}
          title="Notifications"
          description="Email alerts for critical fraud cases"
          status="Coming Soon"
          statusColor="text-amber-600 bg-amber-50"
        />
        <SettingsCard
          icon={Users}
          title="User Management"
          description="Manage analyst roles and permissions"
          status="Coming Soon"
          statusColor="text-amber-600 bg-amber-50"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <Settings className="h-4 w-4 text-gray-500" />
          Scoring Engine
        </h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span>SLA Window</span>
            <span className="font-medium text-gray-900">48 hours</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span>Critical Threshold</span>
            <span className="font-medium text-gray-900">≥ 80</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span>High Threshold</span>
            <span className="font-medium text-gray-900">≥ 60</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span>Medium Threshold</span>
            <span className="font-medium text-gray-900">≥ 35</span>
          </div>
          <div className="flex justify-between py-2">
            <span>Auto-close Low Risk</span>
            <span className="font-medium text-gray-900">Disabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ icon: Icon, title, description, status, statusColor }: {
  icon: any; title: string; description: string; status: string; statusColor: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Icon className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
          {status}
        </span>
      </div>
    </div>
  );
}
