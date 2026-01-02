
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
import ProfilePage from './pages/ProfilePage';
import Login from './pages/Login';
import ForceChangePassword from './pages/ForceChangePassword';

const AppContent: React.FC = () => {
  const { currentUser } = useFleet();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const isAdmin = currentUser?.username === 'admin';

  useEffect(() => {
    const handleStartSchedule = (e: any) => {
      setSelectedScheduleId(e.detail);
      setActiveTab('operation');
    };
    window.addEventListener('start-schedule', handleStartSchedule);
    return () => window.removeEventListener('start-schedule', handleStartSchedule);
  }, []);

  useEffect(() => {
    const restrictedTabs = ['fleet', 'drivers', 'monitoring'];
    if (!isAdmin && restrictedTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, isAdmin]);

  if (!currentUser) return <Login />;
  if (currentUser && !currentUser.passwordChanged) return <ForceChangePassword />;

  const handleStartFromSchedule = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setActiveTab('operation');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview onStartSchedule={handleStartFromSchedule} onNavigate={setActiveTab} />;
      case 'fleet':
        return isAdmin ? <FleetManager /> : <DashboardOverview onStartSchedule={handleStartFromSchedule} onNavigate={setActiveTab} />;
      case 'drivers':
        return isAdmin ? <DriverManagement /> : <DashboardOverview onStartSchedule={handleStartFromSchedule} onNavigate={setActiveTab} />;
      case 'operation':
        return (
          <OperationWizard 
            scheduledTripId={selectedScheduleId || undefined} 
            onComplete={() => {
              setSelectedScheduleId(null);
              setActiveTab('dashboard'); // Redireciona para o dashboard após iniciar
            }} 
          />
        );
      case 'history':
        return <HistoryPage />;
      case 'monitoring':
        return isAdmin ? <TripMonitoring /> : <DashboardOverview onStartSchedule={handleStartFromSchedule} onNavigate={setActiveTab} />;
      case 'scheduling':
        return <SchedulingPage />;
      case 'reports':
        return <ReportsPage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <DashboardOverview onStartSchedule={handleStartFromSchedule} onNavigate={setActiveTab} />;
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
