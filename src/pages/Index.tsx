import { WizardProvider } from "@/contexts/WizardContext";
import { WizardContainer } from "@/components/SEOWizard/WizardContainer";

const Index = () => {
  return (
    <WizardProvider>
      <WizardContainer />
    </WizardProvider>
  );
};

export default Index;