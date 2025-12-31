
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

type ReportType = 'trips' | 'consumption' | 'fines' | 'management';

const ReportsPage: React.FC = () => {
  const { vehicles, drivers, completedTrips, fines, maintenanceRecords, currentUser } = useFleet();
  const [activeReport, setActiveReport] = useState<ReportType>('trips');
  
  const isAdmin = currentUser?.username === 'admin';

  // Date Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Data filtering logic
  const filteredTrips = useMemo(() => {
    return completedTrips.filter(t => {
      const tripDate = t.startTime.split('T')[0];
      const matchesDate = tripDate >= startDate && tripDate <= endDate;
      const matchesUser = isAdmin ? true : t.driverId === currentUser?.id;
      return matchesDate && matchesUser;
    });
  }, [completedTrips, startDate, endDate, isAdmin, currentUser]);

  const filteredFines = useMemo(() => {
    return fines.filter(f => {
      const matchesDate = f.date >= startDate && f.date <= endDate;
      const matchesUser = isAdmin ? true : f.driverId === currentUser?.id;
      return matchesDate && matchesUser;
    });
  }, [fines, startDate, endDate, isAdmin, currentUser]);

  const filteredMaintenance = useMemo(() => {
    return maintenanceRecords.filter(m => m.date >= startDate && m.date <= endDate);
  }, [maintenanceRecords, startDate, endDate]);

  // Report 1: Trip Volume Data
  const tripChartData = useMemo(() => {
    if (isAdmin) {
      return drivers.map(d => {
        const count = filteredTrips.filter(t => t.driverId === d.id).length;
        return { name: d.name.split(' ')[0], viagens: count };
      }).filter(s => s.viagens > 0);
    } else {
      // For single driver, show trips by day
      const dailyMap: Record<string, number> = {};
      filteredTrips.forEach(t => {
        const day = new Date(t.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dailyMap[day] = (dailyMap[day] || 0) + 1;
      });
      return Object.entries(dailyMap).map(([name, viagens]) => ({ name, viagens }));
    }
  }, [drivers, filteredTrips, isAdmin]);

  // Report 4: Management Summary
  const managementSummary = useMemo(() => {
    const totalDist = filteredTrips.reduce((sum, t) => sum + (t.distance || 0), 0);
    const totalMaintCost = filteredMaintenance.reduce((sum, m) => sum + m.cost, 0);
    const totalFineCost = filteredFines.reduce((sum, f) => sum + f.value, 0);
    const totalTripFuel = filteredTrips.reduce((sum, t) => sum + (t.fuelExpense || 0), 0);
    const totalTripOther = filteredTrips.reduce((sum, t) => sum + (t.otherExpense || 0), 0);
    
    return { totalDist, totalMaintCost, totalFineCost, totalTripFuel, totalTripOther };
  }, [filteredTrips, filteredMaintenance, filteredFines]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Indicadores de Performance</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            {isAdmin ? 'Análise Gerencial da Frota' : 'Meus Resultados Operacionais'}
          </p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] font-write text-slate-400 uppercase mb-1">Início</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-write text-slate-400 uppercase mb-1">Fim</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'trips', label: 'Viagens', icon: 'fa-route', adminOnly: false },
          { id: 'consumption', label: 'Consumo', icon: 'fa-gas-pump', adminOnly: false },
          { id: 'fines', label: 'Multas', icon: 'fa-gavel', adminOnly: false },
          { id: 'management', label: 'Gerencial', icon: 'fa-briefcase', adminOnly: true },
        ].filter(t => !t.adminOnly || isAdmin).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as ReportType)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-write text-[10px] uppercase tracking-widest transition-all ${
              activeReport === tab.id 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <i className={`fas ${tab.icon}`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 animate-in fade-in duration-500">
        {activeReport === 'trips' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">
                {isAdmin ? 'Volume de Viagens por Condutor' : 'Viagens Realizadas no Período'}
              </h3>
              <div className="h-80 w-full">
                {tripChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tripChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="viagens" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 italic font-medium">Nenhum dado no período selecionado</div>
                )}
              </div>
            </div>
            <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col justify-between shadow-2xl">
              <div>
                <i className="fas fa-info-circle text-blue-400 text-2xl mb-4"></i>
                <h4 className="text-lg font-write uppercase mb-4">Sumário</h4>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total de Viagens</p>
                    <p className="text-4xl font-write tracking-tighter">{filteredTrips.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">KM Rodados</p>
                    <p className="text-3xl font-write tracking-tighter">{managementSummary.totalDist.toLocaleString()} km</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeReport === 'consumption' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
               <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Gasto em Combustível</p>
               <p className="text-3xl font-write text-emerald-600">R$ {managementSummary.totalTripFuel.toLocaleString()}</p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
               <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Outras Despesas de Viagem</p>
               <p className="text-3xl font-write text-blue-600">R$ {managementSummary.totalTripOther.toLocaleString()}</p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
               <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Custo Total de Operação</p>
               <p className="text-3xl font-write text-slate-800">R$ {(managementSummary.totalTripFuel + managementSummary.totalTripOther).toLocaleString()}</p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
               <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Custo Médio por KM</p>
               <p className="text-3xl font-write text-indigo-600">
                 R$ {managementSummary.totalDist > 0 ? ((managementSummary.totalTripFuel + managementSummary.totalTripOther) / managementSummary.totalDist).toFixed(2) : '0.00'}
               </p>
            </div>
          </div>
        )}
        
        {activeReport === 'fines' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden p-8 text-center">
             <i className="fas fa-gavel text-4xl text-slate-200 mb-4"></i>
             <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-2">Multas e Infrações</h3>
             <p className="text-4xl font-write text-red-600 mb-2">{filteredFines.length}</p>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Multas acumuladas no período selecionado (R$ {managementSummary.totalFineCost.toLocaleString()})</p>
          </div>
        )}

        {activeReport === 'management' && isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
               <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Manutenção Preventiva/Corretiva</p>
               <p className="text-3xl font-write text-slate-800">R$ {managementSummary.totalMaintCost.toLocaleString()}</p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
               <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Despesas Operacionais (Viagens)</p>
               <p className="text-3xl font-write text-emerald-600">R$ {(managementSummary.totalTripFuel + managementSummary.totalTripOther).toLocaleString()}</p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
               <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Total Geral de Despesas</p>
               <p className="text-3xl font-write text-red-600">R$ {(managementSummary.totalMaintCost + managementSummary.totalFineCost + managementSummary.totalTripFuel + managementSummary.totalTripOther).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
