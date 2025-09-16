'use client';

import { motion } from 'framer-motion';
import Container from './Container';

const PageHeader = ({ title, bg = ' ' }) => {
  return (
    <div className="h-[550px] bg-[url('/redcom_portada.jpg')] bg-cover bg-no-repeat
             bg-black/20 bg-blend-multiply text-white py-20 relative shadow-2xl">

      <Container className='absolute bottom-[-6%] left-1/2 -translate-x-1/2'>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className=""
        >
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className={`text-2xl font-bold py-4 px-20 rounded-full shadow-2xl ${bg} `}
          >
          {/* <span className=''> {title} </span> */}
            {title}
          </motion.h1>
        </motion.div>
      </Container>
          

    </div>
  );
};

export default PageHeader;