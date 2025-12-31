
import React, { useState, useEffect } from 'react';
import { FleetProvider, useFleet } from './context/FleetContext';
import Layout from './components/Layout';
import DashboardOverview from './components/DashboardOverview';
import FleetManager from './pages/FleetManager';
import DriverManagement from './pages/DriverManagement';
import OperationWizard from './pages/OperationWizard';
import TripMonitoring from './pages/TripMonitoring';
import SchedulingPage from './pages/SchedulingPage';
import ReportsPage from './pages/ReportsPage';
import HistoryPage from './pages/HistoryPage';
import Login from './pages/Login';
import ForceChangePassword from './pages/ForceChangePassword';

const AppContent: React.FC = () => {
  const { currentUser } = useFleet();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const isAdmin = currentUser?.username === 'admin';

  useEffect(() => {
    const restrictedTabs = ['fleet', 'drivers', 'monitoring'];
    if (!isAdmin && restrictedTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, isAdmin]);

  if (!currentUser) {
    return <Login />;
  }

  // Se for o primeiro acesso (senha não alterada), força a troca
  if (currentUser && !currentUser.passwordChanged) {
    return <ForceChangePassword />;
  }

  const handleStartFromSchedule = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setActiveTab('operation');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview onStartSchedule={handleStartFromSchedule} />;
      case 'fleet':
        return isAdmin ? <FleetManager /> : <DashboardOverview onStartSchedule={handleStartFromSchedule} />;
      case 'drivers':
        return isAdmin ? <DriverManagement /> : <DashboardOverview onStartSchedule={handleStartFromSchedule} />;
      case 'operation':
        return (
          <OperationWizard 
            scheduledTripId={selectedScheduleId || undefined} 
            onComplete={() => setSelectedScheduleId(null)} 
          />
        );
      case 'history':
        return <HistoryPage />;
      case 'monitoring':
        return isAdmin ? <TripMonitoring /> : <DashboardOverview onStartSchedule={handleStartFromSchedule} />;
      case 'scheduling':
        return <SchedulingPage />;
      case 'reports':
        return <ReportsPage />;
      default:
        return <DashboardOverview onStartSchedule={handleStartFromSchedule} />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={(tab) => {
      setActiveTab(tab);
      if (tab !== 'operation') setSelectedScheduleId(null);
    }}>
      {renderContent()}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <FleetProvider>
      <AppContent />
    </FleetProvider>
  );
};

export default App;
