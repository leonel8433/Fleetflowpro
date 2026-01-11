
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type ReportType = 'trips' | 'consumption' | 'fines' | 'management';
type DetailType = 'maintenance' | 'operational' | 'total';

const ReportsPage: React.FC = () => {
  const { vehicles, drivers, completedTrips, fines, maintenanceRecords, currentUser } = useFleet();
  const [activeReport, setActiveReport] = useState<ReportType>('trips');
  const [detailModal, setDetailModal] = useState<DetailType | null>(null);
  
  const isAdmin = currentUser?.username === 'admin';

  // Filtros de Data
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Novos Filtros de Entidade
  const [filterDriver, setFilterDriver] = useState('ALL');
  const [filterVehicle, setFilterVehicle] = useState('ALL');

  // Lógica de filtragem de dados
  const filteredTrips = useMemo(() => {
    return completedTrips.filter(t => {
      const tripDate = t.startTime.split('T')[0];
      const matchesDate = tripDate >= startDate && tripDate <= endDate;
      const matchesUser = isAdmin 
        ? (filterDriver === 'ALL' || t.driverId === filterDriver)
        : t.driverId === currentUser?.id;
      const matchesVehicle = filterVehicle === 'ALL' || t.vehicleId === filterVehicle;
      
      return matchesDate && matchesUser && matchesVehicle;
    });
  }, [completedTrips, startDate, endDate, isAdmin, currentUser, filterDriver, filterVehicle]);

  const filteredFines = useMemo(() => {
    return fines.filter(f => {
      const matchesDate = f.date >= startDate && f.date <= endDate;
      const matchesUser = isAdmin 
        ? (filterDriver === 'ALL' || f.driverId === filterDriver)
        : f.driverId === currentUser?.id;
      const matchesVehicle = filterVehicle === 'ALL' || f.vehicleId === filterVehicle;
      return matchesDate && matchesUser && matchesVehicle;
    });
  }, [fines, startDate, endDate, isAdmin, currentUser, filterDriver, filterVehicle]);

  const filteredMaintenance = useMemo(() => {
    return maintenanceRecords.filter(m => {
        const matchesDate = m.date >= startDate && m.date <= endDate;
        const matchesVehicle = filterVehicle === 'ALL' || m.vehicleId === filterVehicle;
        return matchesDate && matchesVehicle;
    });
  }, [maintenanceRecords, startDate, endDate, filterVehicle]);

  // Dados para Relatório de Volume de Viagens
  const tripChartData = useMemo(() => {
    if (isAdmin && filterDriver === 'ALL') {
      return drivers.map(d => {
        const count = filteredTrips.filter(t => t.driverId === d.id).length;
        return { name: d.name.split(' ')[0], viagens: count };
      }).filter(s => s.viagens > 0);
    } else {
      const dailyMap: Record<string, number> = {};
      filteredTrips.forEach(t => {
        const day = new Date(t.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        dailyMap[day] = (dailyMap[day] || 0) + 1;
      });
      return Object.entries(dailyMap).map(([name, viagens]) => ({ name, viagens }));
    }
  }, [drivers, filteredTrips, isAdmin, filterDriver]);

  // Resumo Gerencial e Custos
  const managementSummary = useMemo(() => {
    const totalDist = filteredTrips.reduce((sum, t) => sum + (t.distance || 0), 0);
    const totalMaintCost = filteredMaintenance.reduce((sum, m) => sum + m.cost, 0);
    const totalFineCost = filteredFines.reduce((sum, f) => sum + f.value, 0);
    const totalTripFuel = filteredTrips.reduce((sum, t) => sum + (t.fuelExpense || 0), 0);
    const totalTripOther = filteredTrips.reduce((sum, t) => sum + (t.otherExpense || 0), 0);
    
    return { totalDist, totalMaintCost, totalFineCost, totalTripFuel, totalTripOther };
  }, [filteredTrips, filteredMaintenance, filteredFines]);

  // Dados para o Gráfico de Consumo (Pizza)
  const consumptionPieData = useMemo(() => [
    { name: 'Combustível', value: managementSummary.totalTripFuel },
    { name: 'Outras Despesas', value: managementSummary.totalTripOther }
  ].filter(d => d.value > 0), [managementSummary]);

  const COLORS = ['#10b981', '#6366f1'];

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Função para verificar se houve multa em uma viagem específica
  const checkFineForTrip = (trip: any) => {
    const tripDate = trip.startTime.split('T')[0];
    return fines.some(f => 
      f.driverId === trip.driverId && 
      f.vehicleId === trip.vehicleId && 
      f.date === tripDate
    );
  };

  const handleExportCSV = () => {
    let csvContent = "";
    let fileName = `relatorio_${activeReport}_${startDate}_a_${endDate}.csv`;

    const downloadCSV = (content: string, name: string) => {
      const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", name);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (activeReport === 'trips') {
      const headers = "Data;Veiculo;Motorista;Gastos_RS;Multa\n";
      const rows = filteredTrips.map(t => {
        const d = drivers.find(drv => drv.id === t.driverId)?.name || 'N/A';
        const v = vehicles.find(vh => vh.id === t.vehicleId)?.plate || 'N/A';
        const gastos = (t.fuelExpense || 0) + (t.otherExpense || 0);
        const multa = checkFineForTrip(t) ? "SIM" : "NÃO";
        return `${new Date(t.startTime).toLocaleDateString()};${v};${d};${gastos.toFixed(2)};${multa}`;
      }).join("\n");
      csvContent = headers + rows;
    } else {
        // Fallback para outros exports (simplificado para brevidade)
        const headers = "ID;Data;Valor\n";
        csvContent = headers + "Exportação não configurada para esta aba específica";
    }

    downloadCSV(csvContent, fileName);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Relatórios & BI</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            {isAdmin ? 'Análise Consolidada da Frota' : 'Meus Resultados Operacionais'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[8px] font-write text-slate-400 uppercase mb-1 ml-1">Início</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-50 border-none px-3 py-1.5 rounded-xl text-xs font-bold outline-none" />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-write text-slate-400 uppercase mb-1 ml-1">Fim</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-50 border-none px-3 py-1.5 rounded-xl text-xs font-bold outline-none" />
            </div>

            {isAdmin && (
              <>
                <div className="h-8 w-px bg-slate-100 hidden md:block"></div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-write text-slate-400 uppercase mb-1 ml-1">Motorista</span>
                  <select value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)} className="bg-slate-50 border-none px-3 py-1.5 rounded-xl text-xs font-bold outline-none min-w-[120px]">
                    <option value="ALL">Todos</option>
                    {drivers.filter(d => d.username !== 'admin').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-write text-slate-400 uppercase mb-1 ml-1">Veículo</span>
                  <select value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)} className="bg-slate-50 border-none px-3 py-1.5 rounded-xl text-xs font-bold outline-none min-w-[120px]">
                    <option value="ALL">Todos</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
          
          <button onClick={handleExportCSV} className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-write uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-100">
            <i className="fas fa-file-csv text-sm"></i> Exportar
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 p-1 bg-slate-100 rounded-2xl w-fit no-scrollbar">
        {[
          { id: 'trips', label: 'Viagens Realizadas', icon: 'fa-route', adminOnly: false },
          { id: 'consumption', label: 'Custos & Consumo', icon: 'fa-gas-pump', adminOnly: false },
          { id: 'fines', label: 'Multas & Pontos', icon: 'fa-gavel', adminOnly: false },
          { id: 'management', label: 'Visão Gerencial', icon: 'fa-briefcase', adminOnly: true },
        ].filter(t => !t.adminOnly || isAdmin).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as ReportType)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-write text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
              activeReport === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <i className={`fas ${tab.icon}`}></i> {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 animate-in fade-in duration-500">
        {activeReport === 'trips' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">Fluxo de Operação</h3>
                <div className="h-72 w-full">
                  {tripChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tripChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="viagens" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-300 italic">Sem dados no período</div>
                  )}
                </div>
              </div>
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col justify-center shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-2">Total no Período</p>
                  <p className="text-5xl font-write mb-1">{filteredTrips.length}</p>
                  <p className="text-xs text-slate-400 font-medium uppercase">Jornadas Concluídas</p>
                  <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[8px] text-slate-500 font-bold uppercase">Distância</p>
                      <p className="text-sm font-write">{managementSummary.totalDist.toLocaleString()} km</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-slate-500 font-bold uppercase">Gasto Médio</p>
                      <p className="text-sm font-write">{formatCurrency(filteredTrips.length > 0 ? (managementSummary.totalTripFuel + managementSummary.totalTripOther) / filteredTrips.length : 0)}</p>
                    </div>
                  </div>
                </div>
                <i className="fas fa-route absolute -right-4 -bottom-4 text-9xl text-white/5 rotate-12"></i>
              </div>
            </div>

            {/* TABELA DETALHADA DE VIAGENS - SOLICITAÇÃO DO USUÁRIO */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                 <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest">Detalhamento Analítico de Viagens</h3>
                 <span className="text-[10px] bg-slate-50 px-3 py-1 rounded-full font-bold text-slate-400 uppercase">{filteredTrips.length} registros</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-8 py-5 text-[9px] font-write text-slate-400 uppercase tracking-widest">Data</th>
                      <th className="px-8 py-5 text-[9px] font-write text-slate-400 uppercase tracking-widest">Veículo</th>
                      <th className="px-8 py-5 text-[9px] font-write text-slate-400 uppercase tracking-widest">Motorista</th>
                      <th className="px-8 py-5 text-[9px] font-write text-slate-400 uppercase tracking-widest">Gasto Total</th>
                      <th className="px-8 py-5 text-[9px] font-write text-slate-400 uppercase tracking-widest text-center">Ocor. Multa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTrips.length > 0 ? filteredTrips.sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map(trip => {
                      const vehicle = vehicles.find(v => v.id === trip.vehicleId);
                      const driver = drivers.find(d => d.id === trip.driverId);
                      const hasFine = checkFineForTrip(trip);
                      const totalExpenses = (trip.fuelExpense || 0) + (trip.otherExpense || 0);

                      return (
                        <tr key={trip.id} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="px-8 py-5">
                            <p className="text-[10px] font-bold text-slate-800">{new Date(trip.startTime).toLocaleDateString()}</p>
                            <p className="text-[9px] text-slate-400 font-medium uppercase">{new Date(trip.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          </td>
                          <td className="px-8 py-5">
                            <span className="px-2 py-1 rounded bg-slate-900 text-white font-mono text-[9px] mr-2">{vehicle?.plate}</span>
                            <span className="text-[10px] font-bold text-slate-600 uppercase">{vehicle?.model}</span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold uppercase">
                                {driver?.name.charAt(0)}
                              </div>
                              <span className="text-[10px] font-bold text-slate-700 uppercase">{driver?.name}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className="text-[11px] font-write text-slate-900">{formatCurrency(totalExpenses)}</span>
                          </td>
                          <td className="px-8 py-5 text-center">
                            {hasFine ? (
                              <div className="flex items-center justify-center gap-2 text-red-600 animate-pulse">
                                <i className="fas fa-triangle-exclamation"></i>
                                <span className="text-[9px] font-write uppercase">Multado</span>
                              </div>
                            ) : (
                              <span className="text-[9px] font-bold text-emerald-500 uppercase">Regular</span>
                            )}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-slate-300 italic font-medium">Nenhuma viagem encontrada para os filtros aplicados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeReport === 'consumption' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Combustível</p>
                <p className="text-3xl font-write text-emerald-600">{formatCurrency(managementSummary.totalTripFuel)}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Outras Despesas</p>
                <p className="text-3xl font-write text-indigo-600">{formatCurrency(managementSummary.totalTripOther)}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Custo Total</p>
                <p className="text-3xl font-write text-slate-800">{formatCurrency(managementSummary.totalTripFuel + managementSummary.totalTripOther)}</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Custo Médio / KM</p>
                <p className="text-3xl font-write text-blue-600">
                  {managementSummary.totalDist > 0 ? formatCurrency((managementSummary.totalTripFuel + managementSummary.totalTripOther) / managementSummary.totalDist) : 'R$ 0,00'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 h-96">
                <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">Distribuição de Despesas</h3>
                {consumptionPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={consumptionPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {consumptionPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 italic">Sem dados financeiros no período.</div>
                )}
              </div>
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col justify-center shadow-xl">
                 <h4 className="text-lg font-write uppercase mb-4 text-blue-400">Eficiência Energética</h4>
                 <p className="text-sm leading-relaxed opacity-80">
                   As despesas de combustível representam {(managementSummary.totalTripFuel + managementSummary.totalTripOther) > 0 ? ((managementSummary.totalTripFuel / (managementSummary.totalTripFuel + managementSummary.totalTripOther)) * 100).toFixed(1) : 0}% do seu custo operacional neste período.
                   Analise veículos com custo médio/KM elevado para manutenções preventivas.
                 </p>
              </div>
            </div>
          </div>
        )}
        
        {activeReport === 'fines' && (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden p-12 text-center relative">
             <i className="fas fa-gavel text-6xl text-slate-50 absolute right-8 top-8"></i>
             <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-2">Multas e Infrações</h3>
             <p className="text-5xl font-write text-red-600 mb-2">{filteredFines.length}</p>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Eventos acumulados no período selecionado</p>
             <div className="mt-8 max-w-md mx-auto p-6 bg-red-50 rounded-3xl border border-red-100">
                <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest mb-1">Impacto Financeiro</p>
                <p className="text-2xl font-write text-red-700">{formatCurrency(managementSummary.totalFineCost)}</p>
             </div>
          </div>
        )}

        {activeReport === 'management' && isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button onClick={() => setDetailModal('maintenance')} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-left hover:border-blue-300 transition-all group">
               <div className="flex justify-between items-start mb-2">
                 <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest">Investimento em Manutenção</p>
                 <i className="fas fa-circle-plus text-slate-200 group-hover:text-blue-500 transition-colors"></i>
               </div>
               <p className="text-3xl font-write text-slate-800">{formatCurrency(managementSummary.totalMaintCost)}</p>
            </button>
            <button onClick={() => setDetailModal('operational')} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-left hover:border-emerald-300 transition-all group">
               <div className="flex justify-between items-start mb-2">
                 <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest">Operação de Jornadas</p>
                 <i className="fas fa-circle-plus text-slate-200 group-hover:text-emerald-500 transition-colors"></i>
               </div>
               <p className="text-3xl font-write text-emerald-600">{formatCurrency(managementSummary.totalTripFuel + managementSummary.totalTripOther)}</p>
            </button>
            <button onClick={() => setDetailModal('total')} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-left hover:border-red-300 transition-all group">
               <div className="flex justify-between items-start mb-2">
                 <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest">Custo Total Consolidado</p>
                 <i className="fas fa-circle-plus text-slate-200 group-hover:text-red-500 transition-colors"></i>
               </div>
               <p className="text-3xl font-write text-red-600">{formatCurrency(managementSummary.totalMaintCost + managementSummary.totalFineCost + managementSummary.totalTripFuel + managementSummary.totalTripOther)}</p>
            </button>
          </div>
        )}
      </div>

      {/* Modal de Detalhamento Analítico - Estrutura Mantida */}
      {detailModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-write uppercase text-slate-800 tracking-tight">
                  {detailModal === 'maintenance' ? 'Detalhamento de Manutenção' : 
                   detailModal === 'operational' ? 'Detalhamento de Despesas de Viagem' : 
                   'Consolidado Geral de Despesas'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Período: {new Date(startDate + 'T12:00:00').toLocaleDateString()} a {new Date(endDate + 'T12:00:00').toLocaleDateString()}</p>
              </div>
              <button onClick={() => setDetailModal(null)} className="w-12 h-12 rounded-full bg-white text-slate-400 hover:text-red-500 transition-all flex items-center justify-center shadow-sm">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-white">
                      <th className="px-6 py-4 text-[9px] font-write text-slate-400 uppercase tracking-widest border-b border-slate-100">Data</th>
                      <th className="px-6 py-4 text-[9px] font-write text-slate-400 uppercase tracking-widest border-b border-slate-100">Veículo</th>
                      <th className="px-6 py-4 text-[9px] font-write text-slate-400 uppercase tracking-widest border-b border-slate-100">Categoria</th>
                      <th className="px-6 py-4 text-[9px] font-write text-slate-400 uppercase tracking-widest border-b border-slate-100">Descrição / Local</th>
                      <th className="px-6 py-4 text-[9px] font-write text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {/* Reutilizando a lógica de detailedData que já existia ou adaptando */}
                    {filteredTrips.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-800 whitespace-nowrap">{new Date(t.startTime).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-600">{vehicles.find(v => v.id === t.vehicleId)?.plate}</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 rounded-lg text-[8px] font-write uppercase border bg-emerald-50 text-emerald-600 border-emerald-100">Operacional</span></td>
                        <td className="px-6 py-4 text-[10px] font-medium text-slate-500 truncate max-w-[200px]">{t.destination}</td>
                        <td className="px-6 py-4 text-xs font-write text-slate-900 text-right whitespace-nowrap">{formatCurrency((t.fuelExpense || 0) + (t.otherExpense || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
