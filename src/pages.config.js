import Calendar from './pages/Calendar';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import InstallerDashboard from './pages/InstallerDashboard';
import InstallerProjectDetail from './pages/InstallerProjectDetail';
import Invoiceprint from './pages/Invoiceprint';
import Invoices from './pages/Invoices';
import MyInvoices from './pages/MyInvoices';
import MyTimesheets from './pages/MyTimesheets';
import ProjectDetail from './pages/ProjectDetail';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import TimesheetApproval from './pages/TimesheetApproval';
import VehicleDetail from './pages/VehicleDetail';
import Vehicles from './pages/Vehicles';
import WorkerDetail from './pages/WorkerDetail';
import Workers from './pages/Workers';
import Tasks from './pages/Tasks';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Calendar": Calendar,
    "Dashboard": Dashboard,
    "Home": Home,
    "InstallerDashboard": InstallerDashboard,
    "InstallerProjectDetail": InstallerProjectDetail,
    "Invoiceprint": Invoiceprint,
    "Invoices": Invoices,
    "MyInvoices": MyInvoices,
    "MyTimesheets": MyTimesheets,
    "ProjectDetail": ProjectDetail,
    "Projects": Projects,
    "Settings": Settings,
    "TimesheetApproval": TimesheetApproval,
    "VehicleDetail": VehicleDetail,
    "Vehicles": Vehicles,
    "WorkerDetail": WorkerDetail,
    "Workers": Workers,
    "Tasks": Tasks,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};